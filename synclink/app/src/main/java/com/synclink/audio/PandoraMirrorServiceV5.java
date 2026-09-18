package com.synclink.audio;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
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

import java.util.ArrayList;
import java.util.Locale;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;

public class PandoraMirrorServiceV5 extends Service {
    public static final String ACTION_STOP = "com.synclink.audio.V5_STOP_PANDORA_MIRROR";
    public static final String ACTION_STATUS = "com.synclink.audio.V5_PANDORA_MIRROR_STATUS";
    private static final String CH = "synclink_mirror_v5";
    private static final int ID = 4512;

    private volatile boolean running;
    private Thread captureThread;
    private MediaProjection projection;
    private AudioRecord record;
    private final ArrayList<MirrorSink> sinks = new ArrayList<>();
    private SharedPreferences prefs;

    @Override public void onCreate() {
        super.onCreate();
        prefs = getSharedPreferences("synclink", MODE_PRIVATE);
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26 && nm != null) nm.createNotificationChannel(new NotificationChannel(CH, "SyncLink Pandora mirror", NotificationManager.IMPORTANCE_LOW));
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) { stopMirror(); status("Pandora mirror stopped."); stopSelf(); return START_NOT_STICKY; }
        int resultCode = intent == null ? 0 : intent.getIntExtra("resultCode", 0);
        Intent data = Build.VERSION.SDK_INT >= 33 ? (intent == null ? null : intent.getParcelableExtra("resultData", Intent.class)) : (intent == null ? null : intent.getParcelableExtra("resultData"));
        Notification n = notification("Testing Pandora capture before routing anything…");
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION); else startForeground(ID, n);
        if (data == null || resultCode == 0) { status("Capture permission was not granted. Your existing media route was left alone."); stopSelf(); return START_NOT_STICKY; }
        startSafeMirror(resultCode, data);
        return START_STICKY;
    }

    private void startSafeMirror(int resultCode, Intent data) {
        stopMirror();
        try {
            MediaProjectionManager mpm = getSystemService(MediaProjectionManager.class);
            projection = mpm == null ? null : mpm.getMediaProjection(resultCode, data);
            if (projection == null) throw new IllegalStateException("No MediaProjection token");
            ApplicationInfo pandora = getPackageManager().getApplicationInfo("com.pandora.android", 0);
            AudioPlaybackCaptureConfiguration config = new AudioPlaybackCaptureConfiguration.Builder(projection).addMatchingUid(pandora.uid).addMatchingUsage(AudioAttributes.USAGE_MEDIA).addMatchingUsage(AudioAttributes.USAGE_UNKNOWN).addMatchingUsage(AudioAttributes.USAGE_GAME).build();
            int rate = 48000, channel = AudioFormat.CHANNEL_IN_STEREO;
            int min = AudioRecord.getMinBufferSize(rate, channel, AudioFormat.ENCODING_PCM_16BIT);
            int buf = Math.max(min * 6, 65536);
            record = new AudioRecord.Builder().setAudioPlaybackCaptureConfig(config).setAudioFormat(new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(rate).setChannelMask(channel).build()).setBufferSizeInBytes(buf).build();
            running = true; record.startRecording();
            status("Listening for real Pandora PCM… your outputs have not been changed yet.");
            captureThread = new Thread(() -> captureLoop(rate), "SyncLink-V5-Capture"); captureThread.start();
        } catch (PackageManager.NameNotFoundException e) { status("Pandora is not installed."); stopSelf(); }
        catch (Throwable t) { status("Pandora capture could not start: " + t.getClass().getSimpleName()); stopSelf(); }
    }

    private void captureLoop(int rate) {
        short[] pcm = new short[4096]; long deadline = System.nanoTime() + 5_000_000_000L; int goodChunks = 0;
        try {
            while (running && System.nanoTime() < deadline) { int n = record.read(pcm, 0, pcm.length, AudioRecord.READ_BLOCKING); if (n <= 0) continue; double rms = rms(pcm, n); int peak = peak(pcm, n); if (rms > 18.0 || peak > 140) goodChunks++; else goodChunks = 0; if (goodChunks >= 3) break; }
            if (!running) return;
            if (goodChunks < 3) { status("Pandora returned digital silence or blocked playback capture. SyncLink did NOT create phone/Sony outputs, so your existing Bluetooth route was left untouched."); stopSelf(); return; }
            if (!createSinks(rate)) { status("Pandora is capturable, but Android did not verify any requested extra output route."); stopSelf(); return; }
            for (int i = 0; i < 12; i++) { int n = record.read(pcm, 0, pcm.length, AudioRecord.READ_NON_BLOCKING); if (n <= 0) break; }
            status("Pandora captured ✓  Verified live mirror routes: " + sinkNames() + ".");
            while (running) { int n = record.read(pcm, 0, pcm.length, AudioRecord.READ_BLOCKING); if (n <= 0) continue; for (MirrorSink sink : new ArrayList<>(sinks)) sink.enqueue(pcm, n); }
        } catch (Throwable t) { if (running) status("Pandora mirror stopped: " + t.getClass().getSimpleName()); }
        finally { stopMirror(); }
    }

    private boolean createSinks(int rate) {
        AudioManager am = getSystemService(AudioManager.class); if (am == null) return false;
        AudioDeviceInfo phone = null, extra = null; String extraName = prefs.getString("extra_output_name", "");
        for (AudioDeviceInfo d : am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) { if (d.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER && phone == null) phone = d; if (!extraName.isEmpty() && isBluetoothOutput(d) && matches(extraName, deviceName(d))) extra = d; }
        int systemComp = prefs.getInt("delay_system", 0), phoneComp = prefs.getInt("delay_phone", 180), extraComp = prefs.getInt("delay_extra", 0);
        int phoneMirrorDelay = Math.max(0, phoneComp - systemComp), extraMirrorDelay = Math.max(0, extraComp - systemComp);
        int phoneUsage = prefs.getInt("phone_route_usage", AudioAttributes.USAGE_MEDIA);
        ArrayList<MirrorSink> requested = new ArrayList<>();
        if (phone != null) requested.add(new MirrorSink("phone", phone, phoneMirrorDelay, rate, phoneUsage, true));
        if (extra != null) requested.add(new MirrorSink(deviceName(extra), extra, extraMirrorDelay, rate, AudioAttributes.USAGE_MEDIA, false));
        for (MirrorSink sink : requested) if (sink.start()) sinks.add(sink);
        return !sinks.isEmpty();
    }

    private boolean isBluetoothOutput(AudioDeviceInfo d) { int t=d.getType(); return t==AudioDeviceInfo.TYPE_BLUETOOTH_A2DP||t==AudioDeviceInfo.TYPE_BLUETOOTH_SCO||t==AudioDeviceInfo.TYPE_BLE_HEADSET||t==AudioDeviceInfo.TYPE_BLE_SPEAKER||t==AudioDeviceInfo.TYPE_HEARING_AID; }
    private String sinkNames() { ArrayList<String> names=new ArrayList<>(); for(MirrorSink s:sinks) names.add(s.name); return String.join(" + ",names); }
    private double rms(short[] pcm,int n){double sum=0;int step=Math.max(1,n/1024),c=0;for(int i=0;i<n;i+=step){double v=pcm[i];sum+=v*v;c++;}return Math.sqrt(sum/Math.max(1,c));}
    private int peak(short[] pcm,int n){int p=0,step=Math.max(1,n/1024);for(int i=0;i<n;i+=step)p=Math.max(p,Math.abs((int)pcm[i]));return p;}

    private class MirrorSink {
        final String name; final AudioDeviceInfo device; final int delayMs,rate,usage; final boolean expectBuiltInSpeaker;
        final ArrayBlockingQueue<short[]> queue=new ArrayBlockingQueue<>(10); volatile boolean open; AudioTrack track; Thread writer;
        MirrorSink(String name,AudioDeviceInfo device,int delayMs,int rate,int usage,boolean expectBuiltInSpeaker){this.name=name;this.device=device;this.delayMs=Math.min(1500,Math.max(0,delayMs));this.rate=rate;this.usage=usage;this.expectBuiltInSpeaker=expectBuiltInSpeaker;}
        boolean start(){
            int bytesPerSecond=rate*2*2, bufferBytes=Math.max(bytesPerSecond*2,262144);
            track=new AudioTrack.Builder().setAudioAttributes(new AudioAttributes.Builder().setUsage(usage).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build()).setAudioFormat(new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(rate).setChannelMask(AudioFormat.CHANNEL_OUT_STEREO).build()).setBufferSizeInBytes(bufferBytes).setTransferMode(AudioTrack.MODE_STREAM).build();
            if(track.getState()!=AudioTrack.STATE_INITIALIZED){status("Could not initialize the " + name + " audio track.");safeReleaseTrack();return false;}
            boolean preferenceAccepted;
            try{preferenceAccepted=track.setPreferredDevice(device);}catch(Throwable t){preferenceAccepted=false;}
            if(!preferenceAccepted){status("Android rejected " + name + " as a preferred output before playback started.");safeReleaseTrack();return false;}
            int baseMs=18, silenceFrames=rate*(baseMs+delayMs)/1000;
            if(silenceFrames>0)track.write(new short[silenceFrames*2],0,silenceFrames*2,AudioTrack.WRITE_BLOCKING);
            track.play();
            AudioDeviceInfo actual=waitForRoute(1500);
            boolean routeOk=expectBuiltInSpeaker ? actual!=null&&actual.getType()==AudioDeviceInfo.TYPE_BUILTIN_SPEAKER : actual!=null&&(actual.getId()==device.getId()||matches(deviceName(device),deviceName(actual)));
            if(!routeOk){String actualName=actual==null?"no routed device after 1.5 seconds":deviceName(actual);status("Android did not verify the requested " + name + " route; actual route: " + actualName + ". SyncLink rejected that sink.");safeReleaseTrack();return false;}
            open=true;
            writer=new Thread(()->{try{while(open&&running){short[] chunk=queue.poll(500,TimeUnit.MILLISECONDS);if(chunk==null)continue;int off=0;while(off<chunk.length&&open&&running){int wrote=track.write(chunk,off,chunk.length-off,AudioTrack.WRITE_BLOCKING);if(wrote<=0)break;off+=wrote;}}}catch(Throwable ignored){ }},"SyncLink-Sink-"+name.replace(' ','_'));
            writer.start(); return true;
        }
        private AudioDeviceInfo waitForRoute(long timeoutMs){long end=System.nanoTime()+timeoutMs*1_000_000L;AudioDeviceInfo actual=null;while(running&&System.nanoTime()<end){try{actual=track.getRoutedDevice();if(actual!=null)return actual;Thread.sleep(50);}catch(Throwable ignored){break;}}return actual;}
        private void safeReleaseTrack(){try{if(track!=null){try{track.pause();}catch(Exception ignored){}try{track.flush();}catch(Exception ignored){}track.release();}}catch(Exception ignored){}track=null;}
        void enqueue(short[] source,int n){if(!open||n<=0)return;short[] copy=new short[n];System.arraycopy(source,0,copy,0,n);if(!queue.offer(copy)){queue.poll();queue.offer(copy);}}
        void close(){open=false;queue.clear();if(writer!=null)writer.interrupt();writer=null;safeReleaseTrack();}
    }

    private String deviceName(AudioDeviceInfo d){String p=d.getProductName()==null?"":d.getProductName().toString();return p.trim().isEmpty()?"Audio device "+d.getId():p;}
    private boolean matches(String a,String b){String x=norm(a),y=norm(b);return !x.isEmpty()&&!y.isEmpty()&&(x.equals(y)||x.contains(y)||y.contains(x));}
    private String norm(String s){return s==null?"":s.toLowerCase(Locale.US).replace("nick's","").replace("nick’s","").replaceAll("[^a-z0-9]","");}
    private Notification notification(String text){if(Build.VERSION.SDK_INT>=26)return new Notification.Builder(this,CH).setSmallIcon(android.R.drawable.ic_media_play).setContentTitle("SyncLink Pandora Mirror").setContentText(text).setOngoing(true).build();return new Notification.Builder(this).setSmallIcon(android.R.drawable.ic_media_play).setContentTitle("SyncLink Pandora Mirror").setContentText(text).setOngoing(true).build();}
    private void status(String text){NotificationManager nm=getSystemService(NotificationManager.class);if(nm!=null)nm.notify(ID,notification(text));sendBroadcast(new Intent(ACTION_STATUS).setPackage(getPackageName()).putExtra("text",text));}
    private synchronized void stopMirror(){running=false;if(captureThread!=null&&captureThread!=Thread.currentThread())captureThread.interrupt();captureThread=null;for(MirrorSink sink:new ArrayList<>(sinks))sink.close();sinks.clear();try{if(record!=null){record.stop();record.release();}}catch(Exception ignored){}record=null;try{if(projection!=null)projection.stop();}catch(Exception ignored){}projection=null;}
    @Override public void onDestroy(){stopMirror();super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}
