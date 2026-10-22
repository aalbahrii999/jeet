package app.jeet;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONObject;

/** One device-owned rest timer, independent of the Activity and WebView. */
public final class RestAlarm {
    private static final String PREFS = "jeet.rest";
    private static final String CHANNEL = "jeet.rest.finished";
    private static final int NOTIFICATION = 44;

    private RestAlarm() {}

    public static synchronized String start(Context context, String payload) {
        PendingIntent next = null;
        AlarmManager manager = context.getSystemService(AlarmManager.class);
        if (manager == null) return "null";
        try {
            JSONObject timer = new JSONObject(payload);
            String id = timer.getString("id");
            String key = timer.getString("exerciseKey");
            String name = timer.getString("exerciseName");
            int seconds = timer.getInt("duration");
            if (id.isEmpty() || id.length() > 80 || key.length() > 200 || name.length() > 120 || seconds < 1 || seconds > 600) {
                return "null";
            }
            long deadline = SystemClock.elapsedRealtime() + seconds * 1000L;
            next = pending(context, id);
            boolean exact = schedule(context, manager, deadline, next);
            timer.put("native", true);
            timer.put("exact", exact);
            timer.put("endAt", System.currentTimeMillis() + seconds * 1000L);
            SharedPreferences store = prefs(context);
            String previous = previousId(store);
            if (!store.edit().putString("timer", timer.toString())
                    .putLong("deadline", deadline).putBoolean("completed", false).commit()) {
                manager.cancel(next);
                return "null";
            }
            if (previous != null && !previous.equals(id)) manager.cancel(pending(context, previous));
            NotificationManagerCompat.from(context).cancel(NOTIFICATION);
            stopVibration(context);
            return timer.toString();
        } catch (Exception ignored) {
            if (next != null) manager.cancel(next);
            return "null";
        }
    }

    public static synchronized void cancel(Context context) {
        SharedPreferences store = prefs(context);
        String id = previousId(store);
        AlarmManager manager = context.getSystemService(AlarmManager.class);
        if (id != null && manager != null) manager.cancel(pending(context, id));
        store.edit().clear().commit();
        stopVibration(context);
        NotificationManagerCompat.from(context).cancel(NOTIFICATION);
    }

    public static synchronized String status(Context context) {
        SharedPreferences store = prefs(context);
        try {
            String raw = store.getString("timer", null);
            if (raw == null) return "null";
            JSONObject timer = new JSONObject(raw);
            long deadline = store.getLong("deadline", 0);
            long remaining = Math.max(0, deadline - SystemClock.elapsedRealtime());
            if (!store.getBoolean("completed", false)) {
                if (remaining == 0) {
                    fire(context, timer.getString("id"));
                } else {
                    AlarmManager manager = context.getSystemService(AlarmManager.class);
                    if (manager != null) {
                        // Returning from the exact-alarm settings upgrades the
                        // existing alarm without restarting its countdown.
                        boolean exact = schedule(context, manager, deadline, pending(context, timer.getString("id")));
                        timer.put("exact", exact);
                        store.edit().putString("timer", timer.toString()).apply();
                    }
                }
            }
            timer.put("endAt", System.currentTimeMillis() + remaining);
            return timer.toString();
        } catch (Exception ignored) {
            return "null";
        }
    }

    static synchronized void fire(Context context, String id) {
        SharedPreferences store = prefs(context);
        if (id == null || !id.equals(previousId(store)) || store.getBoolean("completed", false)) return;
        long deadline = store.getLong("deadline", 0);
        AlarmManager manager = context.getSystemService(AlarmManager.class);
        if (deadline > SystemClock.elapsedRealtime()) {
            if (manager != null) schedule(context, manager, deadline, pending(context, id));
            return;
        }
        // Persist completion before the alert so duplicate broadcasts and
        // WebView resumes cannot vibrate twice for one timer.
        if (!store.edit().putBoolean("completed", true).commit()) return;
        if (manager != null) manager.cancel(pending(context, id));
        Vibrator vibrator = context.getSystemService(Vibrator.class);
        if (vibrator != null && vibrator.hasVibrator()) {
            AudioAttributes attributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
            vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0, 300, 180, 300, 180, 500}, -1), attributes);
        }
        showNotification(context);
    }

    private static boolean schedule(Context context, AlarmManager manager, long deadline, PendingIntent intent) {
        if (Build.VERSION.SDK_INT < 31 || manager.canScheduleExactAlarms()) {
            try {
                // Consecutive workout rests are much shorter than Doze's
                // allow-while-idle quota. A user-visible alarm clock avoids
                // that quota instead of silently delaying the second rest.
                long when = System.currentTimeMillis() + Math.max(0, deadline - SystemClock.elapsedRealtime());
                manager.setAlarmClock(new AlarmManager.AlarmClockInfo(when, openTimer(context)), intent);
                return true;
            } catch (SecurityException ignored) {
                // The permission can change between checking and scheduling.
            }
        }
        manager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, deadline, intent);
        return false;
    }

    private static PendingIntent pending(Context context, String id) {
        Intent intent = new Intent(context, RestAlarmReceiver.class);
        intent.setAction("app.jeet.REST_FINISHED");
        intent.setData(new Uri.Builder().scheme("jeet").authority("rest").appendPath(id).build());
        intent.putExtra("id", id);
        return PendingIntent.getBroadcast(context, 401, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent openTimer(Context context) {
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, 401, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void showNotification(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL, "انتهاء الراحة", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("تنبيه نهاية الراحة بين الجولات");
        channel.setSound(null, null);
        // Vibrate once explicitly, including when notification permission is
        // denied. A second channel vibration would duplicate the alert.
        channel.enableVibration(false);
        manager.createNotificationChannel(channel);
        try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION,
                    new NotificationCompat.Builder(context, CHANNEL)
                            .setSmallIcon(R.drawable.ic_stat)
                            .setContentTitle("انتهت الراحة")
                            .setContentText("جاهز للجولة التالية")
                            .setCategory(NotificationCompat.CATEGORY_ALARM)
                            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                            .setPriority(NotificationCompat.PRIORITY_HIGH)
                            .setAutoCancel(true).setContentIntent(openTimer(context)).build());
        } catch (SecurityException ignored) {
            // The vibration does not depend on POST_NOTIFICATIONS permission.
        }
    }

    private static String previousId(SharedPreferences store) {
        try {
            String raw = store.getString("timer", null);
            return raw == null ? null : new JSONObject(raw).getString("id");
        } catch (Exception ignored) {
            return null;
        }
    }

    private static void stopVibration(Context context) {
        Vibrator vibrator = context.getSystemService(Vibrator.class);
        if (vibrator != null) vibrator.cancel();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
