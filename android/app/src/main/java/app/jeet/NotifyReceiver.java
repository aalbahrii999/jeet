package app.jeet;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class NotifyReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String kind = intent == null ? "gym" : intent.getStringExtra("kind");
        ReminderScheduler.show(context, kind == null ? "gym" : kind);
        ReminderScheduler.schedule(context);
    }
}
