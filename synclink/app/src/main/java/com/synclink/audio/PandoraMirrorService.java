package com.synclink.audio;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioDeviceInfo;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioPlaybackCaptureConfiguration;
import android.media.AudioRecord;
import android.media.AudioTrack;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.IBinder;

public class PandoraMirrorService extends Service {
    public static final String ACTION_STOP = "com.synclink.audio.STOP_PANDORA_MIRROR";
    private static final String CH = "synclink_mirror";
    private static final int ID = 4312;

    private volatile boolean running;
    private Thread worker;
    private MediaProjection projection;
    private AudioRecord record;
    private AudioTrack phoneTrack;

    @Override public void onCreate() {
        super.onCreate();
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26 && nm != null) {
            nm.createNotificationChannel(new NotificationChannel(CH, "SyncLink audio mirror", NotificationManager.IMPORTANCE_LOW));
        }
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopMirror();
            stopSelf();
            return START_NOT_STICKY;
        }
        int resultCode = intent == null ? 0 : intent.getIntExtra("resultCode", 0);
        Intent data;
        if (Build.VERSION.SDK_INT >= 33) data = intent == null ? null : intent.getParcelableExtra("resultData", Intent.class);
        else data = intent == null ? null : intent.getParcelableExtra("resultData");

        Notification n = notification("Starting Pandora mirror…");
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        else startForeground(ID, n);

        if (data == null || resultCode == 0) {
            update("Capture permission was not granted.");
            stopSelf();
            return START_NOT_STICKY;
        }
        startMirror(resultCode, data);
        return START_STICKY;
    }

    private void startMirror(int resultCode, Intent data) {
        stopMirror();
        try {
            MediaProjectionManager mpm = getSystemService(MediaProjectionManager.class);
            projection = mpm == null ? null : mpm.getMediaProjection(resultCode, data);
            if (projection == null) throw new IllegalStateException("No MediaProjection token");

            ApplicationInfo pandora = getPackageManager().getApplicationInfo("com.pandora.android", 0);
            AudioPlaybackCaptureConfiguration config = new AudioPlaybackCaptureConfiguration.Builder(projection)
                    .addMatchingUid(pandora.uid)
                    .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
                    .build();

            int rate = 48000;
            int channel = AudioFormat.CHANNEL_IN_STEREO;
            int min = AudioRecord.getMinBufferSize(rate, channel, AudioFormat.ENCODING_PCM_16BIT);
            int buf = Math.max(min * 4, 32768);
            record = new AudioRecord.Builder()
                    .setAudioPlaybackCaptureConfig(config)
                    .setAudioFormat(new AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(rate)
                            .setChannelMask(channel)
                            .build())
                    .setBufferSizeInBytes(buf)
                    .build();

            AudioDeviceInfo phone = findPhoneSpeaker();
            if (phone == null) throw new IllegalStateException("Phone speaker not exposed");
            int outChannel = AudioFormat.CHANNEL_OUT_STEREO;
            phoneTrack = new AudioTrack.Builder()
                    .setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                            .build())
                    .setAudioFormat(new AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(rate)
                            .setChannelMask(outChannel)
                            .build())
                    .setBufferSizeInBytes(buf)
                    .setTransferMode(AudioTrack.MODE_STREAM)
                    .build();
            phoneTrack.setPreferredDevice(phone);
            phoneTrack.play();
            record.startRecording();
            running = true;
            worker = new Thread(() -> pump(buf), "SyncLink-PandoraMirror");
            worker.start();
            update("Pandora mirror active → phone speaker");
        } catch (PackageManager.NameNotFoundException e) {
            update("Pandora is not installed.");
            stopSelf();
        } catch (Throwable t) {
            update("Mirror failed: " + t.getClass().getSimpleName());
            stopSelf();
        }
    }

    private void pump(int buf) {
        short[] pcm = new short[Math.max(2048, buf / 2)];
        long samples = 0;
        long energy = 0;
        boolean announced = false;
        try {
            while (running) {
                int n = record.read(pcm, 0, pcm.length, AudioRecord.READ_BLOCKING);
                if (n > 0) {
                    for (int i = 0; i < n; i += 16) { long v = pcm[i]; energy += v * v; samples++; }
                    phoneTrack.write(pcm, 0, n, AudioTrack.WRITE_BLOCKING);
                    if (!announced && samples > 12000) {
                        double rms = Math.sqrt((double) energy / Math.max(1, samples));
                        if (rms < 18) update("Capture is silent — Pandora may be blocking playback capture.");
                        else update("Pandora audio captured ✓  Mirror → phone speaker");
                        announced = true;
                    }
                }
            }
        } catch (Throwable ignored) {
        } finally {
            stopMirror();
        }
    }

    private AudioDeviceInfo findPhoneSpeaker() {
        AudioManager am = getSystemService(AudioManager.class);
        if (am == null) return null;
        for (AudioDeviceInfo d : am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
            if (d.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) return d;
        }
        return null;
    }

    private Notification notification(String text) {
        return new Notification.Builder(this, Build.VERSION.SDK_INT >= 26 ? CH : "")
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setContentTitle("SyncLink Pandora Mirror")
                .setContentText(text)
                .setOngoing(true)
                .build();
    }

    private void update(String text) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(ID, notification(text));
    }

    private synchronized void stopMirror() {
        running = false;
        if (worker != null && worker != Thread.currentThread()) {
            try { worker.interrupt(); } catch (Exception ignored) {}
        }
        worker = null;
        try { if (record != null) { record.stop(); record.release(); } } catch (Exception ignored) {}
        record = null;
        try { if (phoneTrack != null) { phoneTrack.pause(); phoneTrack.flush(); phoneTrack.release(); } } catch (Exception ignored) {}
        phoneTrack = null;
        try { if (projection != null) projection.stop(); } catch (Exception ignored) {}
        projection = null;
    }

    @Override public void onDestroy() {
        stopMirror();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
