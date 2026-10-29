<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Queued so that sending mail does not make "known email" requests measurably slower (D5).
 * The link points to the SPA, which posts token + email + new password to /api/auth/reset-password.
 */
class ResetPasswordNotification extends ResetPassword implements ShouldQueue
{
    use Queueable;

    /**
     * @param  mixed  $notifiable
     */
    protected function resetUrl($notifiable): string
    {
        $query = http_build_query([
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ]);

        return rtrim((string) config('app.frontend_url'), '/').'/reset-password?'.$query;
    }

    /**
     * @param  string  $url
     */
    protected function buildMailMessage($url): MailMessage
    {
        $minutes = (int) config('auth.passwords.'.config('auth.defaults.passwords').'.expire');

        return (new MailMessage)
            ->subject('ورّدلي — إعادة تعيين كلمة المرور')
            ->greeting('مرحباً،')
            ->line('وصلنا طلب لإعادة تعيين كلمة المرور لحسابك في ورّدلي.')
            ->action('تعيين كلمة مرور جديدة', $url)
            ->line("الرابط صالح لمدة {$minutes} دقيقة، ويُستخدم مرة واحدة فقط.")
            ->line('إذا لم تطلب ذلك فتجاهل هذه الرسالة، ولن يتغيّر شيء في حسابك.')
            ->salutation('فريق ورّدلي');
    }
}
