package com.synclink.audio;

import android.Manifest;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivityV4 extends MainActivityV3 {
    private static final int REQ_RECORD = 9400;
    private static final int REQ_CAPTURE = 9401;
    private LinearLayout overlay;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        addV4Controls();
    }

    private void addV4Controls() {
        overlay = new LinearLayout(this);
        overlay.setOrientation(LinearLayout.VERTICAL);
        overlay.setPadding(dp4(12), dp4(10), dp4(12), dp4(12));
        overlay.setBackground(round4(Color.rgb(10, 14, 27), 18));

        TextView title = new TextView(this);
        title.setText("v0.4 • Pandora mirror test");
        title.setTextColor(Color.WHITE);
        title.setTextSize(13);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        overlay.addView(title);

        TextView info = new TextView(this);
        info.setText("1) Put two Bluetooth speakers on Samsung Dual Audio.  2) Start Pandora mirror.  3) Pandora keeps playing to Bluetooth while SyncLink tries to copy it to the phone speaker.");
        info.setTextColor(Color.rgb(167, 176, 201));
        info.setTextSize(11);
        info.setPadding(0, dp4(4), 0, dp4(8));
        overlay.addView(info);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        Button samsung = button4("SAMSUNG DUAL AUDIO", Color.rgb(44, 52, 82));
        samsung.setOnClickListener(v -> openSamsungMedia());
        row.addView(samsung, new LinearLayout.LayoutParams(0, dp4(46), 1f));
        LinearLayout.LayoutParams gap = new LinearLayout.LayoutParams(dp4(8), 1);
        TextView spacer = new TextView(this); row.addView(spacer, gap);
        Button mirror = button4("MIRROR PANDORA → PHONE", Color.rgb(124, 92, 255));
        mirror.setOnClickListener(v -> beginMirror());
        row.addView(mirror, new LinearLayout.LayoutParams(0, dp4(46), 1f));
        overlay.addView(row);

        Button stop = button4("STOP PANDORA MIRROR", Color.rgb(74, 31, 42));
        stop.setOnClickListener(v -> {
            Intent i = new Intent(this, PandoraMirrorService.class).setAction(PandoraMirrorService.ACTION_STOP);
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i);
            Toast.makeText(this, "Mirror stop requested.", Toast.LENGTH_SHORT).show();
        });
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp4(42));
        sp.topMargin = dp4(8);
        overlay.addView(stop, sp);

        android.widget.FrameLayout.LayoutParams lp = new android.widget.FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        lp.leftMargin = dp4(10); lp.rightMargin = dp4(10); lp.bottomMargin = dp4(10);
        addContentView(overlay, lp);
    }

    private void beginMirror() {
        if (Build.VERSION.SDK_INT < 29) {
            Toast.makeText(this, "Playback capture needs Android 10 or newer.", Toast.LENGTH_LONG).show();
            return;
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_RECORD);
            return;
        }
        requestCapture();
    }

    private void requestCapture() {
        MediaProjectionManager mpm = getSystemService(MediaProjectionManager.class);
        if (mpm == null) { Toast.makeText(this, "MediaProjection is unavailable.", Toast.LENGTH_LONG).show(); return; }
        new AlertDialog.Builder(this)
                .setTitle("Mirror Pandora to the phone speaker")
                .setMessage("Android will ask for screen/audio capture permission. SyncLink only configures the audio-capture stream to match Pandora's app UID; it does not save audio. Keep Pandora playing to your Bluetooth outputs while this mirror is active.")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Continue", (d,w) -> startActivityForResult(mpm.createScreenCaptureIntent(), REQ_CAPTURE))
                .show();
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_RECORD && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) requestCapture();
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_CAPTURE) return;
        if (resultCode != RESULT_OK || data == null) {
            Toast.makeText(this, "Capture permission was not granted.", Toast.LENGTH_LONG).show();
            return;
        }
        Intent s = new Intent(this, PandoraMirrorService.class);
        s.putExtra("resultCode", resultCode);
        s.putExtra("resultData", data);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(s); else startService(s);
        new AlertDialog.Builder(this)
                .setTitle("Mirror started")
                .setMessage("Now play Pandora normally. Its original stream should stay on the Bluetooth output(s), while SyncLink tries to reproduce a captured copy on this phone's speaker. Watch the SyncLink notification: it will say whether Pandora audio is actually capturable or only silence is being returned.")
                .setNegativeButton("Stay here", null)
                .setPositiveButton("Open Pandora", (d,w) -> openPandora4())
                .show();
    }

    private void openPandora4() {
        try {
            Intent i = getPackageManager().getLaunchIntentForPackage("com.pandora.android");
            if (i != null) { startActivity(i); return; }
        } catch (Exception ignored) {}
        Toast.makeText(this, "Pandora isn't installed.", Toast.LENGTH_LONG).show();
    }

    private void openSamsungMedia() {
        try {
            Intent launch = getPackageManager().getLaunchIntentForPackage("com.samsung.android.mdx.quickboard");
            if (launch != null) { startActivity(launch); return; }
        } catch (Exception ignored) {}
        try {
            Intent panel = new Intent("com.android.settings.panel.action.MEDIA_OUTPUT");
            startActivity(panel);
            return;
        } catch (Exception ignored) {}
        new AlertDialog.Builder(this)
                .setTitle("Open Samsung Media output")
                .setMessage("Swipe down from the top-right, tap Media output, and look for the small circles beside the connected Bluetooth speakers. Samsung's own panel is the one that exposes Dual Audio selection.")
                .setPositiveButton("OK", null)
                .show();
    }

    private Button button4(String text, int color) {
        Button b = new Button(this);
        b.setText(text); b.setTextColor(Color.WHITE); b.setTextSize(10); b.setTypeface(Typeface.DEFAULT, Typeface.BOLD); b.setAllCaps(false); b.setBackground(round4(color, 13)); b.setStateListAnimator(null);
        return b;
    }
    private GradientDrawable round4(int color, int r) { GradientDrawable d = new GradientDrawable(); d.setColor(color); d.setCornerRadius(dp4(r)); return d; }
    private int dp4(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }
}
