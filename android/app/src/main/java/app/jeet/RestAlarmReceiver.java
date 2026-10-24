package app.jeet;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class RestAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent != null && "app.jeet.REST_FINISHED".equals(intent.getAction())) {
            RestAlarm.fire(context, intent.getStringExtra("id"));
        }
    }
}
