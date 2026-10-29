<?php

use App\Enums\CompanyStatus;
use App\Models\Area;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Company;
use App\Models\Rfq;
use App\Models\RfqAttachment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;

uses(RefreshDatabase::class);

beforeEach(function () {
    Storage::fake('local');
    $this->buyer = User::factory()->create();
    $this->company = Company::factory()->ownedBy($this->buyer)->create();
    $this->area = Area::factory()->create();
    $this->category = Category::factory()->create(['name_ar' => 'بيليا ورولمان']);
});

function rfqPayload(array $overrides = []): array
{
    return array_merge([
        'description' => 'بيليا لمحرك مضخة المياه، القديمة صار لها صوت',
        'part_number' => '6205-2RS',
        'quantity' => '2',
        'unit' => 'piece',
        'urgency' => 'urgent',
        'area_id' => (string) test()->area->id,
        'category' => (string) test()->category->id,
    ], $overrides);
}

function postRfq(array $payload): TestResponse
{
    return spa()->post('/api/rfqs', $payload, ['Accept' => 'application/json']);
}

it('creates an open RFQ for a known category, owned by the buyer company, and audits it', function () {
    $this->actingAs($this->buyer);

    $response = postRfq(rfqPayload())->assertCreated();

    $rfq = Rfq::query()->sole();
    expect($rfq->buyer_company_id)->toBe($this->company->id)
        ->and($rfq->created_by)->toBe($this->buyer->id)
        ->and($rfq->status->value)->toBe('open')
        ->and($rfq->closes_at->isAfter(now()->addDays(6)))->toBeTrue()
        ->and($response->json('data.id'))->toBe($rfq->ulid)
        ->and($response->json('data.category.name'))->toBe('بيليا ورولمان')
        ->and($response->json('data.part_number'))->toBe('6205-2RS')
        ->and($response->json('data.photos'))->toBe([])
        ->and(array_keys($response->json('data')))->toBe(['id', 'status', 'accepts_quotes', 'selected_quote_id', 'category', 'description', 'part_number', 'machine_make', 'machine_model', 'quantity', 'unit', 'urgency', 'area', 'closes_at', 'created_at', 'photos_count', 'quotes_count', 'photos'])
        ->and($response->getContent())->not->toContain('buyer_company_id')->not->toContain('created_by');

    $log = AuditLog::query()->where('action', 'rfq.created')->sole();
    expect([$log->actor_user_id, $log->subject_type, $log->subject_id])->toBe([$this->buyer->id, 'rfq', $rfq->id])
        ->and($log->meta)->toBe(['status' => 'open', 'category_id' => $this->category->id, 'photos' => 0]);
});

it('sends "I don\'t know the category" to admin review', function () {
    $this->actingAs($this->buyer);

    postRfq(rfqPayload(['category' => 'unknown', 'part_number' => null]))
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending_review')
        ->assertJsonPath('data.category', null);
});

it('validates the payload with Arabic messages', function () {
    $this->actingAs($this->buyer);

    $response = postRfq(['description' => 'ب', 'quantity' => '0', 'unit' => 'ton', 'urgency' => 'now', 'area_id' => '999999'])
        ->assertUnprocessable();

    expect($response->json('errors'))->toMatchArray([
        'description' => ['اكتب وصفاً أوضح للقطعة (3 أحرف على الأقل).'],
        'quantity' => ['الكمية يجب ألا يقل عن 1.'],
        'unit' => ['القيمة المختارة في حقل الوحدة غير صحيحة.'],
        'urgency' => ['القيمة المختارة في حقل درجة الاستعجال غير صحيحة.'],
        'area_id' => ['القيمة المختارة في حقل المنطقة غير موجودة.'],
        'category' => ['اختر تصنيفاً، أو اختر «لا أعرف التصنيف».'],
    ]);
    expect(Rfq::query()->count())->toBe(0);
});

it('rejects unknown, inactive and malformed categories', function (string $category) {
    $this->actingAs($this->buyer);
    if ($category === 'inactive') {
        $category = (string) Category::factory()->inactive()->create()->id;
    }

    postRfq(rfqPayload(['category' => $category]))
        ->assertUnprocessable()
        ->assertJsonPath('errors.category.0', 'اختر تصنيفاً من القائمة، أو اختر «لا أعرف التصنيف».');
})->with(['999999', 'inactive', '1 OR 1=1', '-1']);

it('ignores ownership and status fields smuggled into the payload', function () {
    $this->actingAs($this->buyer);
    $other = Company::factory()->ownedBy()->create();

    postRfq(rfqPayload(['buyer_company_id' => $other->id, 'status' => 'closed', 'created_by' => 1]))->assertCreated();

    $rfq = Rfq::query()->sole();
    expect($rfq->buyer_company_id)->toBe($this->company->id)->and($rfq->status->value)->toBe('open');
});

it('lets only active buyer companies create RFQs', function (string $who, int $status) {
    $user = User::factory()->create();
    match ($who) {
        'pending supplier' => Company::factory()->supplier()->ownedBy($user)->create(),
        'approved supplier' => Company::factory()->supplier(CompanyStatus::Approved)->ownedBy($user)->create(),
        'admin' => $user->forceFill(['is_admin' => true])->save(),
        'suspended buyer company' => Company::factory()->ownedBy($user)->create(['status' => CompanyStatus::Suspended]),
    };
    $this->actingAs($user);

    postRfq(rfqPayload())->assertStatus($status);
    expect(Rfq::query()->count())->toBe(0);
})->with([
    ['pending supplier', 403],
    ['approved supplier', 403],
    ['admin', 403],
    ['suspended buyer company', 403],
]);

it('tells a supplier in Arabic that RFQs are for buyers, before validating anything', function () {
    $supplier = User::factory()->create();
    Company::factory()->supplier(CompanyStatus::Approved)->ownedBy($supplier)->create();
    $this->actingAs($supplier);

    postRfq([])->assertForbidden()->assertJsonPath('message', 'طلبات الأسعار متاحة لحسابات المشترين (الورش والمعامل) فقط.');
});

it('requires login', function () {
    postRfq(rfqPayload())->assertUnauthorized();
});

it('stores photos re-encoded as JPEG on the private disk, downscaled, with generated names', function () {
    $this->actingAs($this->buyer);

    $response = postRfq(rfqPayload(['photos' => [
        UploadedFile::fake()->image('../../evil name.png', 3000, 1500),
        UploadedFile::fake()->image('plate.webp', 800, 600),
    ]]))->assertCreated();

    $photos = RfqAttachment::query()->orderBy('id')->get();
    expect($photos)->toHaveCount(2)
        ->and($response->json('data.photos_count'))->toBe(2)
        ->and([$photos[0]->width, $photos[0]->height])->toBe([2000, 1000])
        ->and([$photos[1]->width, $photos[1]->height])->toBe([800, 600]);

    $rfq = Rfq::query()->sole();
    foreach ($photos as $photo) {
        expect($photo->path)->toMatch("#^rfq-photos/{$rfq->ulid}/[0-9a-z]{26}\.jpg$#")
            ->and($photo->mime)->toBe('image/jpeg');
        Storage::disk('local')->assertExists($photo->path);
        expect(getimagesizefromstring(Storage::disk('local')->get($photo->path))['mime'])->toBe('image/jpeg');
    }
    expect($response->getContent())->not->toContain('rfq-photos')->not->toContain('evil');
});

it('never stores the original bytes: hidden trailing payloads are dropped by re-encoding', function () {
    $this->actingAs($this->buyer);
    $png = UploadedFile::fake()->image('p.png', 50, 50);
    file_put_contents($png->getRealPath(), '<?php system($_GET["c"]); ?>', FILE_APPEND);

    postRfq(rfqPayload(['photos' => [$png]]))->assertCreated();

    $stored = Storage::disk('local')->get(RfqAttachment::query()->sole()->path);
    expect($stored)->not->toContain('<?php');
});

it('rejects files that are not real images, disguised or not', function (string $name, string $content) {
    $this->actingAs($this->buyer);

    postRfq(rfqPayload(['photos' => [UploadedFile::fake()->createWithContent($name, $content)]]))
        ->assertUnprocessable()
        ->assertJsonPath('errors', fn ($errors) => isset($errors['photos.0']));

    expect(Rfq::query()->count())->toBe(0);
    expect(Storage::disk('local')->allFiles())->toBe([]);
})->with([
    'php renamed to jpg' => ['shell.jpg', '<?php echo "x";'],
    'svg (scriptable)' => ['x.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    'pdf' => ['doc.pdf', "%PDF-1.4\n%âãÏÓ\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"],
    'gif' => ['a.gif', base64_decode('R0lGODlhAQABAAAAACw=')],
]);

it('rejects a JPEG/PNG header that claims too many pixels (decompression bomb) before decoding', function () {
    $this->actingAs($this->buyer);
    // Valid PNG signature + IHDR claiming 10000 × 10000 px, no pixel data.
    $ihdr = pack('NNCCCCC', 10000, 10000, 8, 2, 0, 0, 0);
    $png = "\x89PNG\r\n\x1a\n".pack('N', 13).'IHDR'.$ihdr.pack('N', crc32('IHDR'.$ihdr));

    postRfq(rfqPayload(['photos' => [UploadedFile::fake()->createWithContent('huge.png', $png)]]))
        ->assertUnprocessable()
        ->assertJson(['errors' => ['photos.0' => ['تعذّر قراءة الصورة رقم 1. اختر صورة JPG أو PNG أو WebP سليمة وبحجم معقول.']]]);
    expect(Rfq::query()->count())->toBe(0);
});

it('limits photos to 5 per request and 5 MB each', function () {
    $this->actingAs($this->buyer);

    $six = array_map(fn ($i) => UploadedFile::fake()->image("p{$i}.jpg", 10, 10), range(1, 6));
    postRfq(rfqPayload(['photos' => $six]))
        ->assertUnprocessable()
        ->assertJsonPath('errors.photos.0', 'يمكنك إرفاق 5 صور كحد أقصى.');

    postRfq(rfqPayload(['photos' => [UploadedFile::fake()->image('big.jpg', 10, 10)->size(5121)]]))
        ->assertUnprocessable()
        ->assertJson(['errors' => ['photos.0' => ['حجم الصورة كبير جداً. الحد الأقصى 5 ميغابايت للصورة.']]]);

    expect(Rfq::query()->count())->toBe(0);
});

it('rate-limits RFQ creation per user with an Arabic 429', function () {
    $this->actingAs($this->buyer);

    foreach (range(1, 5) as $i) {
        postRfq(rfqPayload())->assertCreated();
    }
    postRfq(rfqPayload())->assertStatus(429)
        ->assertJsonPath('message', 'محاولات كثيرة خلال وقت قصير. انتظر قليلاً ثم حاول مرة أخرى.');
    expect(Rfq::query()->count())->toBe(5);
});
