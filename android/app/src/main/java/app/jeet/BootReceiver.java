package app.jeet;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();
        // A workout rest uses uptime; it must not survive a device reboot.
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)) RestAlarm.cancel(context);
        if (Intent.ACTION_TIME_CHANGED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            RestAlarm.status(context);
        }
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            ReminderScheduler.schedule(context);
        }
    }
}

