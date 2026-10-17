package app.jeet;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.OnApplyWindowInsetsListener;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

public class MainActivity extends AppCompatActivity {
    private static final int NOTIFY_REQUEST = 41;
    private WebView web;
    private String pendingFacing = "environment";
    private boolean cameraAsked = false;
    private File pendingPhoto;

    private final ActivityResultLauncher<String> cameraPermission =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
                if (Boolean.TRUE.equals(granted)) {
                    openCamera();
                    return;
                }
                deliver("denied");
                Toast.makeText(this, R.string.camera_denied, Toast.LENGTH_LONG).show();
                if (cameraAsked && !shouldShowRequestPermissionRationale(android.Manifest.permission.CAMERA)) {
                    Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    intent.setData(Uri.fromParts("package", getPackageName(), null));
                    startActivity(intent);
                }
            });

    private final ActivityResultLauncher<Intent> cameraShot =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                if (pendingPhoto != null && pendingPhoto.exists() && pendingPhoto.length() > 0) {
                    deliver(encodeJpeg(pendingPhoto));
                } else {
                    deliver(null);
                }
                pendingPhoto = null;
            });

    private final ActivityResultLauncher<Intent> galleryPick =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                Uri uri = result.getData() == null ? null : result.getData().getData();
                if (result.getResultCode() != RESULT_OK || uri == null) {
                    deliver(null);
                    return;
                }
                deliver(encodeUri(uri));
            });

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#101412"));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        web.addJavascriptInterface(new Bridge(), "JeetAndroid");

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#101412"));
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        ViewCompat.setOnApplyWindowInsetsListener(root, new OnApplyWindowInsetsListener() {
            @Override
            public WindowInsetsCompat onApplyWindowInsets(View view, WindowInsetsCompat insets) {
                Insets bars = insets.getInsets(
                        WindowInsetsCompat.Type.systemBars()
                                | WindowInsetsCompat.Type.displayCutout()
                                | WindowInsetsCompat.Type.ime()
                );
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsetsCompat.CONSUMED;
            }
        });
        setContentView(root);
        ViewCompat.requestApplyInsets(root);
        web.loadUrl("file:///android_asset/www/index.html");

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                web.evaluateJavascript(
                        "(function(){return window.jeetBack?window.jeetBack():'exit';})()",
                        value -> {
                            if (value != null && value.contains("exit")) finish();
                        }
                );
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIFY_REQUEST && web != null) {
            web.evaluateJavascript(
                    "(function(){return window.jeetSyncReminders?window.jeetSyncReminders():'';})()",
                    null
            );
        }
    }

    private class Bridge {
        @JavascriptInterface
        public void exit() {
            runOnUiThread(MainActivity.this::finish);
        }

        @JavascriptInterface
        public void requestNotify() {
            runOnUiThread(() -> {
                ReminderScheduler.markAsked(MainActivity.this);
                if (Build.VERSION.SDK_INT >= 33
                        && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                        != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(
                            new String[]{android.Manifest.permission.POST_NOTIFICATIONS},
                            NOTIFY_REQUEST
                    );
                }
            });
        }

        @JavascriptInterface
        public void openNotifySettings() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                startActivity(intent);
            });
        }

        @JavascriptInterface
        public String notifyStatus() {
            return ReminderScheduler.status(MainActivity.this);
        }

        @JavascriptInterface
        public void syncReminder(String payload) {
            ReminderScheduler.sync(getApplicationContext(), payload == null ? "{}" : payload);
        }

        @JavascriptInterface
        public void takePhoto(String facing) {
            runOnUiThread(() -> {
                pendingFacing = "user".equals(facing) ? "user" : "environment";
                if (checkSelfPermission(android.Manifest.permission.CAMERA)
                        == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    openCamera();
                    return;
                }
                cameraAsked = true;
                cameraPermission.launch(android.Manifest.permission.CAMERA);
            });
        }

        @JavascriptInterface
        public void pickImage() {
            runOnUiThread(MainActivity.this::openGallery);
        }

        @JavascriptInterface
        public String sharePdf(String base64, String filename) {
            try {
                File file = writePdf(base64, filename);
                runOnUiThread(() -> {
                    Uri uri = FileProvider.getUriForFile(MainActivity.this, "app.jeet.fileprovider", file);
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("application/pdf");
                    send.putExtra(Intent.EXTRA_STREAM, uri);
                    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(send, getString(R.string.share_pdf)));
                });
                return "ok";
            } catch (Exception ignored) {
                return "fail";
            }
        }
    }

    private void openCamera() {
        try {
            File dir = new File(getCacheDir(), "camera");
            if (!dir.exists() && !dir.mkdirs()) {
                deliver(null);
                return;
            }
            pendingPhoto = new File(dir, "shot-" + System.currentTimeMillis() + ".jpg");
            Uri uri = FileProvider.getUriForFile(this, "app.jeet.fileprovider", pendingPhoto);
            Intent take = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            take.putExtra(MediaStore.EXTRA_OUTPUT, uri);
            take.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            if ("user".equals(pendingFacing)) {
                take.putExtra("android.intent.extras.CAMERA_FACING", 1);
                take.putExtra("android.intent.extra.USE_FRONT_CAMERA", true);
            } else {
                take.putExtra("android.intent.extras.CAMERA_FACING", 0);
                take.putExtra("android.intent.extra.USE_FRONT_CAMERA", false);
            }
            cameraShot.launch(take);
        } catch (Exception ignored) {
            deliver(null);
        }
    }

    private void openGallery() {
        Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
        pick.setType("image/*");
        pick.addCategory(Intent.CATEGORY_OPENABLE);
        galleryPick.launch(Intent.createChooser(pick, getString(R.string.pick_photo)));
    }

    private void deliver(String token) {
        if (web == null) return;
        String arg = token == null ? "null" : "'" + token + "'";
        web.evaluateJavascript("window.jeetOnPhoto&&window.jeetOnPhoto(" + arg + ")", null);
    }

    private String encodeUri(Uri uri) {
        File dir = new File(getCacheDir(), "camera");
        if (!dir.exists() && !dir.mkdirs()) return null;
        File dest = new File(dir, "pick-" + System.currentTimeMillis() + ".jpg");
        try (InputStream in = getContentResolver().openInputStream(uri);
             FileOutputStream out = new FileOutputStream(dest)) {
            if (in == null) return null;
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) >= 0) out.write(buf, 0, n);
        } catch (Exception ignored) {
            return null;
        }
        return encodeJpeg(dest);
    }

    private String encodeJpeg(File file) {
        try {
            Bitmap scaled = decodeScaled(file.getAbsolutePath(), 960);
            if (scaled == null) return null;
            Bitmap upright = rotate(file.getAbsolutePath(), scaled);
            ByteArrayOutputStream stream = new ByteArrayOutputStream();
            upright.compress(Bitmap.CompressFormat.JPEG, 72, stream);
            if (upright != scaled) scaled.recycle();
            upright.recycle();
            return Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP);
        } catch (Exception ignored) {
            return null;
        }
    }

    private Bitmap decodeScaled(String path, int max) {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(path, bounds);
        int sample = 1;
        int wide = Math.max(bounds.outWidth, bounds.outHeight);
        while (wide / sample > max * 2) sample *= 2;
        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inSampleSize = sample;
        Bitmap raw = BitmapFactory.decodeFile(path, opts);
        if (raw == null) return null;
        float scale = Math.min(1f, max / (float) Math.max(raw.getWidth(), raw.getHeight()));
        if (scale >= 0.99f) return raw;
        Bitmap out = Bitmap.createScaledBitmap(
                raw,
                Math.max(1, Math.round(raw.getWidth() * scale)),
                Math.max(1, Math.round(raw.getHeight() * scale)),
                true
        );
        if (out != raw) raw.recycle();
        return out;
    }

    private Bitmap rotate(String path, Bitmap src) {
        try {
            ExifInterface exif = new ExifInterface(path);
            int orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
            int degrees = 0;
            if (orientation == ExifInterface.ORIENTATION_ROTATE_90) degrees = 90;
            else if (orientation == ExifInterface.ORIENTATION_ROTATE_180) degrees = 180;
            else if (orientation == ExifInterface.ORIENTATION_ROTATE_270) degrees = 270;
            if (degrees == 0) return src;
            Matrix matrix = new Matrix();
            matrix.postRotate(degrees);
            Bitmap out = Bitmap.createBitmap(src, 0, 0, src.getWidth(), src.getHeight(), matrix, true);
            if (out != src) src.recycle();
            return out;
        } catch (Exception ignored) {
            return src;
        }
    }

    private File writePdf(String base64, String filename) throws Exception {
        String data = base64 == null ? "" : base64;
        int comma = data.indexOf(',');
        if (data.startsWith("data:") && comma >= 0) data = data.substring(comma + 1);
        byte[] bytes = Base64.decode(data, Base64.DEFAULT);
        if (bytes.length == 0) throw new IllegalArgumentException("empty");
        File dir = new File(getCacheDir(), "pdf");
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("dir");
        String safe = filename == null ? "jeet.pdf" : filename.replaceAll("[^A-Za-z0-9._-]", "_");
        if (!safe.endsWith(".pdf")) safe = safe + ".pdf";
        File file = new File(dir, safe);
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(bytes);
        }
        return file;
    }
}
