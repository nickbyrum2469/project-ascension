package com.synclink.audio;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothHeadset;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioAttributes;
import android.media.AudioDeviceInfo;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.AudioTrack;
import android.media.MediaRecorder;
import android.media.MediaRouter2;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.Space;
import android.widget.TextView;
import android.widget.Toast;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

public class MainActivityV5 extends Activity {
    private static final int REQ_BT = 9500;
    private static final int REQ_RECORD = 9501;
    private static final int REQ_CAPTURE = 9502;
    private static final int BG = Color.rgb(8,11,22), PANEL = Color.rgb(17,22,39), PANEL2 = Color.rgb(24,30,52);
    private static final int TEXT = Color.rgb(244,246,255), MUTED = Color.rgb(155,165,192), PURPLE = Color.rgb(124,92,255);
    private static final int GREEN = Color.rgb(74,222,128), ORANGE = Color.rgb(255,145,77), AMBER = Color.rgb(251,191,36), CYAN = Color.rgb(65,210,245), DIM = Color.rgb(82,91,118);

    private BluetoothAdapter bt;
    private AudioManager audio;
    private SharedPreferences prefs;
    private BluetoothProfile a2dp, headset, leAudio;
    private final LinkedHashMap<String, Speaker> devices = new LinkedHashMap<>();
    private final HashSet<String> acl = new HashSet<>();
    private LinearLayout deviceList;
    private TextView connectionStatus, extraLabel, calibrationStatus, pandoraStatus;
    private SeekBar systemDelay, phoneDelay, extraDelay;
    private TextView systemDelayValue, phoneDelayValue, extraDelayValue;
    private volatile boolean calibrating;

    private final BluetoothProfile.ServiceListener profileListener = new BluetoothProfile.ServiceListener() {
        @Override public void onServiceConnected(int profile, BluetoothProfile proxy) {
            if (profile == BluetoothProfile.A2DP) a2dp = proxy;
            if (profile == BluetoothProfile.HEADSET) headset = proxy;
            if (Build.VERSION.SDK_INT >= 31 && profile == BluetoothProfile.LE_AUDIO) leAudio = proxy;
            refresh();
        }
        @Override public void onServiceDisconnected(int profile) {
            if (profile == BluetoothProfile.A2DP) a2dp = null;
            if (profile == BluetoothProfile.HEADSET) headset = null;
            if (Build.VERSION.SDK_INT >= 31 && profile == BluetoothProfile.LE_AUDIO) leAudio = null;
            refresh();
        }
    };

    private final BroadcastReceiver btReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) {
            BluetoothDevice d = deviceFrom(i);
            if (d != null && allowed()) {
                try {
                    if (BluetoothDevice.ACTION_ACL_CONNECTED.equals(i.getAction())) acl.add(d.getAddress());
                    if (BluetoothDevice.ACTION_ACL_DISCONNECTED.equals(i.getAction())) acl.remove(d.getAddress());
                } catch (SecurityException ignored) {}
            }
            refresh();
        }
    };

    private final BroadcastReceiver mirrorReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if (!PandoraMirrorServiceV5.ACTION_STATUS.equals(intent.getAction())) return;
            String text = intent.getStringExtra("text");
            if (pandoraStatus != null && text != null) pandoraStatus.setText(text);
        }
    };

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        prefs = getSharedPreferences("synclink", MODE_PRIVATE);
        BluetoothManager bm = getSystemService(BluetoothManager.class);
        bt = bm == null ? null : bm.getAdapter();
        audio = getSystemService(AudioManager.class);
        setContentView(buildUi());
        registerReceivers();
        requestBluetooth();
        registerProfiles();
        refresh();
        if (!prefs.getBoolean("tutorial_051", false)) new Handler(getMainLooper()).postDelayed(this::showTutorial, 450);
    }

    @Override protected void onResume() { super.onResume(); refresh(); }

    @Override protected void onDestroy() {
        super.onDestroy();
        try { unregisterReceiver(btReceiver); } catch (Exception ignored) {}
        try { unregisterReceiver(mirrorReceiver); } catch (Exception ignored) {}
        if (bt != null) try {
            if (a2dp != null) bt.closeProfileProxy(BluetoothProfile.A2DP, a2dp);
            if (headset != null) bt.closeProfileProxy(BluetoothProfile.HEADSET, headset);
            if (Build.VERSION.SDK_INT >= 31 && leAudio != null) bt.closeProfileProxy(BluetoothProfile.LE_AUDIO, leAudio);
        } catch (Exception ignored) {}
    }

    private View buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BG);
        LinearLayout root = col();
        root.setPadding(dp(18), dp(20), dp(18), dp(42));
        scroll.addView(root);

        LinearLayout header = row();
        TextView logo = text("S", 22, Color.WHITE, true);
        logo.setGravity(Gravity.CENTER); logo.setBackground(round(PURPLE,16));
        header.addView(logo, new LinearLayout.LayoutParams(dp(50),dp(50)));
        LinearLayout titles = col(); titles.addView(text("SyncLink",28,TEXT,true)); titles.addView(text("Adaptive multi-output sync",13,MUTED,false));
        LinearLayout.LayoutParams tlp = new LinearLayout.LayoutParams(0,ViewGroup.LayoutParams.WRAP_CONTENT,1f); tlp.leftMargin=dp(12); header.addView(titles,tlp);
        Button help = button("?",PANEL2); help.setOnClickListener(v->showTutorial()); header.addView(help,new LinearLayout.LayoutParams(dp(46),dp(46)));
        root.addView(header); root.addView(gap(16));

        LinearLayout statusCard = card(Color.rgb(13,25,45),18,16);
        connectionStatus = text("Checking connected speakers…",14,GREEN,true); statusCard.addView(connectionStatus);
        TextView statusHint = text("Samsung Dual Audio is treated as one system group; SyncLink can add the phone and one independently exposed output around it.",12,MUTED,false); statusHint.setPadding(0,dp(6),0,0); statusCard.addView(statusHint);
        root.addView(statusCard); root.addView(gap(24));

        root.addView(step("1","Connect everything","Keep the JBLs and Sony connected. Paired-only devices stay dimmed."));
        root.addView(gap(10));
        Button refresh = button("REFRESH CONNECTIONS",PANEL2); refresh.setOnClickListener(v->refresh()); root.addView(refresh,new LinearLayout.LayoutParams(-1,dp(48)));
        deviceList = col(); root.addView(deviceList);

        root.addView(gap(24));
        root.addView(step("2","Build the route","Put the two JBLs on Samsung Dual Audio. Then choose one extra exposed output—normally your Sony."));
        root.addView(gap(10));
        LinearLayout route = card(PANEL,18,16);
        Button dual = button("OPEN SAMSUNG MEDIA OUTPUT",PANEL2); dual.setOnClickListener(v->openSamsungMedia()); route.addView(dual,new LinearLayout.LayoutParams(-1,dp(48)));
        route.addView(gap(10));
        extraLabel = text("Extra output: auto-detecting…",13,TEXT,true); route.addView(extraLabel);
        route.addView(gap(8));
        Button extra = outline("CHOOSE EXTRA OUTPUT"); extra.setOnClickListener(v->chooseExtraOutput()); route.addView(extra,new LinearLayout.LayoutParams(-1,dp(46)));
        route.addView(gap(10));
        Button phoneProbe = button("TEST PHONE + CURRENT BLUETOOTH", PURPLE);
        phoneProbe.setOnClickListener(v->testPhonePlusBluetooth());
        route.addView(phoneProbe,new LinearLayout.LayoutParams(-1,dp(50)));
        TextView phoneProbeHint = text("This checks whether Samsung will truly let SyncLink keep media on the current Bluetooth output while a second SyncLink track plays from this phone. SyncLink verifies the real routed devices instead of trusting the request.",12,MUTED,false);
        phoneProbeHint.setPadding(0,dp(8),0,0); route.addView(phoneProbeHint);
        route.addView(gap(8));
        Button separateSound = outline("SAMSUNG SEPARATE APP SOUND FALLBACK");
        separateSound.setOnClickListener(v->openSeparateAppSoundHelp());
        route.addView(separateSound,new LinearLayout.LayoutParams(-1,dp(46)));
        root.addView(route);

        root.addView(gap(24));
        root.addView(step("3","Calibrate latency","Auto calibration measures acoustic arrival time with the phone mic, then delays the faster routes to match the slowest one."));
        root.addView(gap(10));
        LinearLayout cal = card(PANEL,18,16);
        calibrationStatus = text("Not calibrated yet. Put the phone where you will listen and turn the speakers up to a normal level.",12,MUTED,false); cal.addView(calibrationStatus);
        cal.addView(gap(12));
        Button auto = button("AUTO CALIBRATE",PURPLE); auto.setOnClickListener(v->beginAutoCalibration()); cal.addView(auto,new LinearLayout.LayoutParams(-1,dp(50)));
        cal.addView(gap(14));
        addDelayControl(cal,"Samsung group delay","delay_system",0);
        addDelayControl(cal,"Phone speaker delay","delay_phone",180);
        addDelayControl(cal,"Extra output delay","delay_extra",0);
        cal.addView(gap(10));
        Button test = outline("RUN SYNCHRONIZED TEST"); test.setOnClickListener(v->runSynchronizedTest()); cal.addView(test,new LinearLayout.LayoutParams(-1,dp(48)));
        TextView testHint = text("The test sends the same click pattern to the Samsung system route, this phone, and the chosen extra output with your saved compensation delays.",12,MUTED,false); testHint.setPadding(0,dp(8),0,0); cal.addView(testHint);
        root.addView(cal);

        root.addView(gap(24));
        root.addView(step("4","Pandora","Pandora keeps its original stream on Samsung Dual Audio. SyncLink first checks whether Android will let us capture Pandora before touching any extra output."));
        root.addView(gap(10));
        LinearLayout music = card(Color.rgb(24,19,40),18,16);
        pandoraStatus = text("Safer mirror mode: if Pandora returns silence, SyncLink stops without changing your media route.",12,MUTED,false); music.addView(pandoraStatus);
        music.addView(gap(12));
        Button openPandora = button("OPEN PANDORA",Color.rgb(36,120,255)); openPandora.setOnClickListener(v->openPandora()); music.addView(openPandora,new LinearLayout.LayoutParams(-1,dp(48)));
        music.addView(gap(9));
        Button mirror = button("ADD PHONE + EXTRA TO PANDORA",PURPLE); mirror.setOnClickListener(v->beginPandoraMirror()); music.addView(mirror,new LinearLayout.LayoutParams(-1,dp(50)));
        music.addView(gap(9));
        Button stop = outline("STOP PANDORA MIRROR"); stop.setOnClickListener(v->stopPandoraMirror()); music.addView(stop,new LinearLayout.LayoutParams(-1,dp(44)));
        root.addView(music);

        root.addView(gap(22)); TextView ver = text("SyncLink v0.5.1 • verified routing + calibration",12,DIM,false); ver.setGravity(Gravity.CENTER); root.addView(ver);
        return scroll;
    }

    private void addDelayControl(LinearLayout parent, String title, String key, int defaultMs) {
        TextView name = text(title,12,TEXT,true); parent.addView(name);
        LinearLayout r = row();
        SeekBar bar = new SeekBar(this); bar.setMax(1500); int value = Math.min(1500, prefs.getInt(key,defaultMs)); bar.setProgress(value);
        TextView valueText = text(value+" ms",12,CYAN,true); valueText.setGravity(Gravity.END);
        r.addView(bar,new LinearLayout.LayoutParams(0,dp(42),1f)); r.addView(valueText,new LinearLayout.LayoutParams(dp(70),-2)); parent.addView(r);
        if ("delay_system".equals(key)) { systemDelay=bar; systemDelayValue=valueText; }
        if ("delay_phone".equals(key)) { phoneDelay=bar; phoneDelayValue=valueText; }
        if ("delay_extra".equals(key)) { extraDelay=bar; extraDelayValue=valueText; }
        bar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){
            @Override public void onProgressChanged(SeekBar seekBar,int progress,boolean fromUser){valueText.setText(progress+" ms"); if(fromUser)prefs.edit().putInt(key,progress).apply();}
            @Override public void onStartTrackingTouch(SeekBar seekBar){}
            @Override public void onStopTrackingTouch(SeekBar seekBar){}
        });
    }

    private View step(String n,String title,String sub){LinearLayout r=row();r.setGravity(Gravity.TOP);TextView badge=text(n,13,Color.WHITE,true);badge.setGravity(Gravity.CENTER);badge.setBackground(round(PURPLE,100));r.addView(badge,new LinearLayout.LayoutParams(dp(30),dp(30)));LinearLayout c=col();c.addView(text(title,19,TEXT,true));TextView t=text(sub,13,MUTED,false);t.setPadding(0,dp(3),0,0);c.addView(t);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,-2,1);p.leftMargin=dp(10);r.addView(c,p);return r;}

    private void registerReceivers(){
        IntentFilter f=new IntentFilter();f.addAction(BluetoothDevice.ACTION_BOND_STATE_CHANGED);f.addAction(BluetoothDevice.ACTION_ACL_CONNECTED);f.addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED);f.addAction("android.bluetooth.a2dp.profile.action.CONNECTION_STATE_CHANGED");f.addAction(BluetoothHeadset.ACTION_CONNECTION_STATE_CHANGED);
        if(Build.VERSION.SDK_INT>=33)registerReceiver(btReceiver,f,Context.RECEIVER_EXPORTED);else registerReceiver(btReceiver,f);
        IntentFilter mf=new IntentFilter(PandoraMirrorServiceV5.ACTION_STATUS);
        if(Build.VERSION.SDK_INT>=33)registerReceiver(mirrorReceiver,mf,Context.RECEIVER_NOT_EXPORTED);else registerReceiver(mirrorReceiver,mf);
    }
    private void registerProfiles(){if(bt!=null&&allowed())try{bt.getProfileProxy(this,profileListener,BluetoothProfile.A2DP);bt.getProfileProxy(this,profileListener,BluetoothProfile.HEADSET);if(Build.VERSION.SDK_INT>=31)bt.getProfileProxy(this,profileListener,BluetoothProfile.LE_AUDIO);}catch(Exception ignored){}}
    private void requestBluetooth(){ArrayList<String> m=new ArrayList<>();if(Build.VERSION.SDK_INT>=31){if(checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED)m.add(Manifest.permission.BLUETOOTH_CONNECT);if(checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)!=PackageManager.PERMISSION_GRANTED)m.add(Manifest.permission.BLUETOOTH_SCAN);}else if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)m.add(Manifest.permission.ACCESS_FINE_LOCATION);if(!m.isEmpty())requestPermissions(m.toArray(new String[0]),REQ_BT);}
    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grantResults){super.onRequestPermissionsResult(requestCode,permissions,grantResults);if(requestCode==REQ_BT){registerProfiles();refresh();}if(requestCode==REQ_RECORD&&grantResults.length>0&&grantResults[0]==PackageManager.PERMISSION_GRANTED)beginAutoCalibration();}
    private boolean allowed(){return Build.VERSION.SDK_INT<31||checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED;}

    private void refresh(){
        if(bt!=null&&allowed())try{for(BluetoothDevice d:bt.getBondedDevices())upsert(d,connected(d));fromProfile(a2dp);fromProfile(headset);if(Build.VERSION.SDK_INT>=31)fromProfile(leAudio);for(Speaker x:devices.values())x.connected=x.device!=null&&connected(x.device);}catch(SecurityException ignored){}
        renderDevices(); autoChooseExtraIfNeeded(); updateConnectionStatus();
    }
    private void fromProfile(BluetoothProfile p){if(p==null||!allowed())return;try{for(BluetoothDevice d:p.getConnectedDevices())upsert(d,true);}catch(SecurityException ignored){}}
    private void upsert(BluetoothDevice d,boolean conn){if(d==null||!allowed())return;try{String a=d.getAddress();if(a==null)return;Speaker x=devices.get(a);if(x==null){x=new Speaker();x.address=a;devices.put(a,x);}x.device=d;String n=d.getName();x.name=n==null||n.trim().isEmpty()?"Unnamed Bluetooth device":n;x.connected=conn;x.bonded=d.getBondState()==BluetoothDevice.BOND_BONDED;classify(x);}catch(SecurityException ignored){}}
    private boolean connected(BluetoothDevice d){if(d==null||!allowed())return false;try{String a=d.getAddress();if(a!=null&&acl.contains(a))return true;if(a2dp!=null&&a2dp.getConnectionState(d)==BluetoothProfile.STATE_CONNECTED)return true;if(headset!=null&&headset.getConnectionState(d)==BluetoothProfile.STATE_CONNECTED)return true;if(Build.VERSION.SDK_INT>=31&&leAudio!=null&&leAudio.getConnectionState(d)==BluetoothProfile.STATE_CONNECTED)return true;try{Method m=BluetoothDevice.class.getMethod("isConnected",int.class);Object b=m.invoke(d,1);if(Boolean.TRUE.equals(b))return true;Object l=m.invoke(d,2);if(Boolean.TRUE.equals(l))return true;}catch(Throwable ignored){}String n=norm(d.getName());for(AudioDeviceInfo o:getOutputDevices())if(match(n,norm(deviceName(o))))return true;}catch(SecurityException ignored){}return false;}
    private void classify(Speaker x){String n=x.name.toLowerCase(Locale.US);x.accent=DIM;x.type="Bluetooth device";if(n.contains("partybox")&&n.contains("club 120")){x.accent=PURPLE;x.type="JBL PartyBox Club 120";}else if(n.contains("flip6")||n.contains("flip 6")){x.accent=ORANGE;x.type="JBL Flip 6";}else if(n.contains("ht-ct370")||n.contains("ct370")){x.accent=AMBER;x.type="Sony HT-CT370";}else if(n.contains("jbl")){x.accent=ORANGE;x.type="JBL Bluetooth speaker";}else if(n.contains("sony")){x.accent=AMBER;x.type="Sony Bluetooth speaker";}}

    private void renderDevices(){if(deviceList==null)return;deviceList.removeAllViews();ArrayList<Speaker> list=new ArrayList<>(devices.values());Collections.sort(list,new Comparator<Speaker>(){public int compare(Speaker a,Speaker b){if(a.connected!=b.connected)return a.connected?-1:1;return a.name.compareToIgnoreCase(b.name);}});for(Speaker x:list){deviceList.addView(gap(8));LinearLayout c=card(PANEL,17,13);c.setAlpha(x.connected?1f:.48f);LinearLayout r=row();TextView dot=text("●",15,x.connected?GREEN:DIM,true);r.addView(dot,new LinearLayout.LayoutParams(dp(28),-2));LinearLayout tx=col();tx.addView(text(x.name,15,x.connected?TEXT:MUTED,true));tx.addView(text(x.type,12,x.connected?x.accent:DIM,true));tx.addView(text(x.connected?"Connected to this phone":"Paired • connect first",12,MUTED,false));r.addView(tx,new LinearLayout.LayoutParams(0,-2,1));r.addView(pill(x.connected?"CONNECTED":"PAIRED",x.connected?Color.rgb(18,68,43):Color.rgb(28,34,57),x.connected?GREEN:MUTED));c.addView(r);deviceList.addView(c);}}
    private void updateConnectionStatus(){int c=0;ArrayList<String> names=new ArrayList<>();for(Speaker x:devices.values())if(x.connected){c++;if(names.size()<3)names.add(shortName(x.name));}if(connectionStatus!=null)connectionStatus.setText(c==0?"No Bluetooth speakers connected":c+" Bluetooth connected • "+String.join(" + ",names));}

    private ArrayList<AudioDeviceInfo> getOutputDevices(){ArrayList<AudioDeviceInfo> out=new ArrayList<>();if(audio==null)return out;for(AudioDeviceInfo d:audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS))out.add(d);return out;}
    private ArrayList<AudioDeviceInfo> exposedBluetoothOutputs(){ArrayList<AudioDeviceInfo> out=new ArrayList<>();for(AudioDeviceInfo d:getOutputDevices()){int t=d.getType();if(t==AudioDeviceInfo.TYPE_BLUETOOTH_A2DP||t==AudioDeviceInfo.TYPE_BLUETOOTH_SCO||t==AudioDeviceInfo.TYPE_BLE_HEADSET||t==AudioDeviceInfo.TYPE_BLE_SPEAKER||t==AudioDeviceInfo.TYPE_HEARING_AID)out.add(d);}return out;}
    private void autoChooseExtraIfNeeded(){String saved=prefs.getString("extra_output_name","");ArrayList<AudioDeviceInfo> list=exposedBluetoothOutputs();if(saved.isEmpty()){for(AudioDeviceInfo d:list)if(norm(deviceName(d)).contains("sony")||norm(deviceName(d)).contains("ct370")){saved=deviceName(d);prefs.edit().putString("extra_output_name",saved).apply();break;}}if(extraLabel!=null)extraLabel.setText(saved.isEmpty()?"Extra output: none selected":"Extra output: "+saved);}
    private void chooseExtraOutput(){ArrayList<AudioDeviceInfo> list=exposedBluetoothOutputs();if(list.isEmpty()){toast("Android is not exposing an extra Bluetooth output right now.");return;}String[] labels=new String[list.size()+1];labels[0]="None";for(int i=0;i<list.size();i++)labels[i+1]=deviceName(list.get(i));new AlertDialog.Builder(this).setTitle("Choose extra output").setItems(labels,(d,which)->{String value=which==0?"":labels[which];prefs.edit().putString("extra_output_name",value).apply();autoChooseExtraIfNeeded();}).show();}
    private AudioDeviceInfo chosenExtra(){String saved=prefs.getString("extra_output_name","");if(saved.isEmpty())return null;for(AudioDeviceInfo d:exposedBluetoothOutputs())if(match(norm(saved),norm(deviceName(d))))return d;return null;}
    private AudioDeviceInfo phoneSpeaker(){for(AudioDeviceInfo d:getOutputDevices())if(d.getType()==AudioDeviceInfo.TYPE_BUILTIN_SPEAKER)return d;return null;}
    private AudioDeviceInfo builtInMic(){if(audio==null)return null;for(AudioDeviceInfo d:audio.getDevices(AudioManager.GET_DEVICES_INPUTS))if(d.getType()==AudioDeviceInfo.TYPE_BUILTIN_MIC)return d;return null;}

    private void beginAutoCalibration(){
        if(calibrating)return;
        if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},REQ_RECORD);return;}
        AudioDeviceInfo extra=chosenExtra(); AudioDeviceInfo phone=phoneSpeaker();
        if(phone==null){toast("Phone speaker is not exposed to SyncLink.");return;}
        calibrating=true;
        calibrationStatus.setText("Calibrating 3 passes per route… SyncLink will verify the REAL output first, then correlate the chirp captured by the microphone. Keep the phone still.");
        new Thread(()->{
            CalResult sys=measureRoute(null,"Samsung group",AudioAttributes.USAGE_MEDIA,false);
            int phoneUsage=prefs.getInt("phone_route_usage",AudioAttributes.USAGE_MEDIA);
            CalResult ph=measureRoute(phone,"Phone",phoneUsage,true);
            CalResult ex=extra==null?CalResult.missing("Extra"):measureRoute(extra,"Extra",AudioAttributes.USAGE_MEDIA,false);
            runOnUiThread(()->{calibrating=false;applyCalibration(sys,ph,ex);});
        },"SyncLink-Calibrate").start();
    }

    private CalResult measureRoute(AudioDeviceInfo preferred,String label,int usage,boolean expectPhone){
        ArrayList<Double> valid=new ArrayList<>(); String actual="unknown"; boolean routeOk=true;
        for(int trial=0;trial<3;trial++){
            CalResult r=measureLatencyOnce(preferred,label,usage,expectPhone);
            if(r.actualRoute!=null&&!r.actualRoute.isEmpty())actual=r.actualRoute;
            if(!r.routeOk)routeOk=false;
            if(r.latencyMs>=0&&r.routeOk)valid.add(r.latencyMs);
            try{Thread.sleep(180);}catch(InterruptedException ignored){}
        }
        if(!routeOk)return new CalResult(label,-1,actual,false,0);
        if(valid.isEmpty())return new CalResult(label,-1,actual,true,0);
        Collections.sort(valid);
        double median=valid.get(valid.size()/2);
        double spread=valid.size()<2?0:valid.get(valid.size()-1)-valid.get(0);
        return new CalResult(label,median,actual,true,spread);
    }

    private CalResult measureLatencyOnce(AudioDeviceInfo preferred,String label,int usage,boolean expectPhone){
        final int rate=48000;
        AudioRecord rec=null; AudioTrack track=null;
        try{
            int min=AudioRecord.getMinBufferSize(rate,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT);
            if(min<=0)min=rate;
            rec=new AudioRecord.Builder()
                    .setAudioSource(MediaRecorder.AudioSource.UNPROCESSED)
                    .setAudioFormat(new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(rate).setChannelMask(AudioFormat.CHANNEL_IN_MONO).build())
                    .setBufferSizeInBytes(Math.max(min*6,rate*3))
                    .build();
            AudioDeviceInfo mic=builtInMic(); if(mic!=null)rec.setPreferredDevice(mic);
            short[] chirp=makeCalibrationChirp(rate,90);
            track=new AudioTrack.Builder()
                    .setAudioAttributes(new AudioAttributes.Builder().setUsage(usage).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                    .setAudioFormat(new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(rate).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                    .setBufferSizeInBytes(chirp.length*2)
                    .setTransferMode(AudioTrack.MODE_STATIC).build();
            if(preferred!=null)track.setPreferredDevice(preferred);
            track.setVolume(0.55f);
            track.write(chirp,0,chirp.length);

            int pre=rate/5; // 200 ms of microphone baseline before playback
            int post=rate;  // search up to 1 second after playback
            short[] capture=new short[pre+post];
            rec.startRecording();
            int got=readFully(rec,capture,0,pre);
            if(got<pre/2)return new CalResult(label,-1,"mic read failed",false,0);
            track.play();
            try{Thread.sleep(80);}catch(InterruptedException ignored){}
            AudioDeviceInfo routed=null; try{routed=track.getRoutedDevice();}catch(Throwable ignored){}
            String actual=routed==null?"no route reported":deviceName(routed);
            boolean routeOk=!expectPhone || (routed!=null&&routed.getType()==AudioDeviceInfo.TYPE_BUILTIN_SPEAKER);
            int remain=capture.length-pre; readFully(rec,capture,pre,remain);
            if(!routeOk)return new CalResult(label,-1,actual,false,0);
            double latency=correlateChirpMs(capture,pre,chirp,rate);
            return new CalResult(label,latency,actual,true,0);
        }catch(Throwable t){
            return new CalResult(label,-1,t.getClass().getSimpleName(),false,0);
        }finally{
            try{if(rec!=null){rec.stop();rec.release();}}catch(Exception ignored){}
            try{if(track!=null){track.stop();track.release();}}catch(Exception ignored){}
        }
    }

    private int readFully(AudioRecord rec,short[] dst,int off,int len){
        int done=0;
        while(done<len){
            int n=rec.read(dst,off+done,len-done,AudioRecord.READ_BLOCKING);
            if(n<=0)break;
            done+=n;
        }
        return done;
    }

    private short[] makeCalibrationChirp(int rate,int ms){
        int frames=rate*ms/1000; short[] out=new short[frames];
        double phase=0;
        for(int i=0;i<frames;i++){
            double x=(double)i/Math.max(1,frames-1);
            double f=900+4100*x;
            phase+=2*Math.PI*f/rate;
            double env=Math.sin(Math.PI*x);
            out[i]=(short)(Math.sin(phase)*env*25000);
        }
        return out;
    }

    private double correlateChirpMs(short[] capture,int expectedStart,short[] chirp,int rate){
        int step=6;
        int start=Math.max(0,expectedStart-rate/50); // allow ~20 ms scheduling jitter
        int end=Math.min(capture.length-chirp.length, expectedStart+rate*9/10);
        if(end<=start)return -1;
        double best=-1; int bestAt=-1;
        for(int pos=start;pos<=end;pos+=step){
            double dot=0,aa=0,bb=0;
            for(int j=0;j<chirp.length;j+=step){
                double a=capture[pos+j], b=chirp[j];
                dot+=a*b; aa+=a*a; bb+=b*b;
            }
            double score=(aa>0&&bb>0)?Math.abs(dot)/Math.sqrt(aa*bb):0;
            if(score>best){best=score;bestAt=pos;}
        }
        if(bestAt<0||best<0.10)return -1;
        return (bestAt-expectedStart)*1000.0/rate;
    }

    private void applyCalibration(CalResult sys,CalResult phone,CalResult extra){
        if(!phone.routeOk){
            calibrationStatus.setText("Calibration stopped: the track requested for THIS PHONE was actually routed to "+phone.actualRoute+". A delay slider cannot fix a routing failure. Run ‘TEST PHONE + CURRENT BLUETOOTH’ first.");
            return;
        }
        ArrayList<Double> vals=new ArrayList<>();
        if(sys.latencyMs>=0)vals.add(sys.latencyMs);
        if(phone.latencyMs>=0)vals.add(phone.latencyMs);
        if(extra.latencyMs>=0)vals.add(extra.latencyMs);
        if(vals.isEmpty()){calibrationStatus.setText("Calibration could not lock onto the chirps. Turn the test volume up, keep the phone still, and retry.");return;}
        double max=0;for(double v:vals)if(v>max)max=v;
        int ds=sys.latencyMs<0?prefs.getInt("delay_system",0):(int)Math.max(0,Math.round(max-sys.latencyMs));
        int dp=phone.latencyMs<0?prefs.getInt("delay_phone",180):(int)Math.max(0,Math.round(max-phone.latencyMs));
        int de=extra.latencyMs<0?prefs.getInt("delay_extra",0):(int)Math.max(0,Math.round(max-extra.latencyMs));
        ds=Math.min(ds,1500);dp=Math.min(dp,1500);de=Math.min(de,1500);
        prefs.edit().putInt("delay_system",ds).putInt("delay_phone",dp).putInt("delay_extra",de)
                .putFloat("lat_system",(float)sys.latencyMs).putFloat("lat_phone",(float)phone.latencyMs).putFloat("lat_extra",(float)extra.latencyMs).apply();
        setDelayUi(systemDelay,systemDelayValue,ds);setDelayUi(phoneDelay,phoneDelayValue,dp);setDelayUi(extraDelay,extraDelayValue,de);
        String extraText=extra.latencyMs<0?"n/a":String.format(Locale.US,"%.0f ms",extra.latencyMs);
        calibrationStatus.setText(String.format(Locale.US,
                "Verified routes + median of 3 passes: Samsung %.0f ms (%s) • Phone %.0f ms (%s) • Extra %s. Compensation: Samsung %d ms • Phone %d ms • Extra %d ms.",
                sys.latencyMs,sys.actualRoute,phone.latencyMs,phone.actualRoute,extraText,ds,dp,de));
    }

    private void setDelayUi(SeekBar bar,TextView value,int ms){if(bar!=null)bar.setProgress(Math.min(1500,ms));if(value!=null)value.setText(ms+" ms");}

    private void testPhonePlusBluetooth(){
        AudioDeviceInfo phone=phoneSpeaker();
        if(phone==null){toast("Android is not exposing the built-in speaker.");return;}
        new Thread(()->{
            int[] usages=new int[]{AudioAttributes.USAGE_MEDIA,AudioAttributes.USAGE_ASSISTANCE_SONIFICATION,AudioAttributes.USAGE_ALARM};
            String[] names=new String[]{"Media","Sonification","Alarm"};
            StringBuilder report=new StringBuilder();
            int successUsage=-1; String successSystem="",successPhone="";
            for(int i=0;i<usages.length;i++){
                ArrayList<AudioTrack> ts=new ArrayList<>();
                try{
                    short[] p=makePulsePattern(48000,0,950);
                    AudioTrack system=buildProbeTrack(null,AudioAttributes.USAGE_MEDIA,p,0.38f);
                    AudioTrack local=buildProbeTrack(phone,usages[i],p,0.38f);
                    ts.add(system);ts.add(local);
                    system.play();local.play();
                    try{Thread.sleep(220);}catch(InterruptedException ignored){}
                    AudioDeviceInfo sr=null,pr=null;try{sr=system.getRoutedDevice();pr=local.getRoutedDevice();}catch(Throwable ignored){}
                    String sName=sr==null?"no route":deviceName(sr);
                    String pName=pr==null?"no route":deviceName(pr);
                    boolean systemExternal=sr!=null&&sr.getType()!=AudioDeviceInfo.TYPE_BUILTIN_SPEAKER;
                    boolean phoneLocal=pr!=null&&pr.getType()==AudioDeviceInfo.TYPE_BUILTIN_SPEAKER;
                    report.append(names[i]).append(": Bluetooth/system → ").append(sName).append(" | phone track → ").append(pName).append("\n");
                    if(systemExternal&&phoneLocal){successUsage=usages[i];successSystem=sName;successPhone=pName;break;}
                    try{Thread.sleep(850);}catch(InterruptedException ignored){}
                }catch(Throwable t){report.append(names[i]).append(": ").append(t.getClass().getSimpleName()).append("\n");}
                finally{for(AudioTrack t:ts)try{t.stop();t.release();}catch(Exception ignored){}}
            }
            final int saved=successUsage;final String rep=report.toString();final String ss=successSystem,sp=successPhone;
            runOnUiThread(()->{
                if(saved!=-1){
                    prefs.edit().putInt("phone_route_usage",saved).apply();
                    new AlertDialog.Builder(this).setTitle("Phone + Bluetooth route verified")
                            .setMessage("YES — Android kept the default media route on "+ss+" while SyncLink independently routed its second track to "+sp+".\n\nSyncLink saved the working phone-routing strategy. Auto Calibration and the synchronized test will use it now.\n\nDiagnostics:\n"+rep)
                            .setPositiveButton("Auto calibrate",(d,w)->beginAutoCalibration()).setNegativeButton("Close",null).show();
                }else{
                    new AlertDialog.Builder(this).setTitle("Android blocked the direct phone route")
                            .setMessage("SyncLink tried three public routing strategies and verified the actual devices. None kept Bluetooth media active while also routing a SyncLink track to the built-in speaker.\n\nThat is why pushing the phone delay to 400 ms did nothing useful — it was a ROUTING problem, not a latency problem.\n\nSamsung’s Separate app sound can still give us a supported fallback for Pandora: keep Pandora on the PartyBox and route SyncLink’s captured mirror to This phone.\n\nDiagnostics:\n"+rep)
                            .setNegativeButton("Close",null).setPositiveButton("Open sound settings",(d,w)->openSeparateAppSoundHelp()).show();
                }
            });
        },"SyncLink-PhoneRouteProbe").start();
    }

    private AudioTrack buildProbeTrack(AudioDeviceInfo preferred,int usage,short[] pcm,float volume){
        AudioTrack t=new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(usage).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                .setAudioFormat(new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(48000).setChannelMask(AudioFormat.CHANNEL_OUT_STEREO).build())
                .setBufferSizeInBytes(pcm.length*2).setTransferMode(AudioTrack.MODE_STATIC).build();
        if(preferred!=null)t.setPreferredDevice(preferred);t.setVolume(volume);t.write(pcm,0,pcm.length);return t;
    }

    private void openSeparateAppSoundHelp(){
        new AlertDialog.Builder(this).setTitle("Samsung Separate app sound fallback")
                .setMessage("Set Separate app sound so SyncLink plays on THIS PHONE while your main media output stays on the PartyBox.\n\nSettings → Sounds and vibration → Separate app sound → Turn on → App: SyncLink → Audio device: Phone.\n\nThen start Pandora on the PartyBox and use SyncLink’s Pandora mirror. This is the clean Samsung-supported way to keep the source app on Bluetooth while SyncLink plays the copied stream from the phone speaker.")
                .setNegativeButton("Cancel",null).setPositiveButton("Open Sounds & vibration",(d,w)->{try{startActivity(new Intent(Settings.ACTION_SOUND_SETTINGS));}catch(Exception e){startActivity(new Intent(Settings.ACTION_SETTINGS));}}).show();
    }

    private static class CalResult{
        final String label;final double latencyMs;final String actualRoute;final boolean routeOk;final double spreadMs;
        CalResult(String l,double ms,String actual,boolean ok,double spread){label=l;latencyMs=ms;actualRoute=actual==null?"unknown":actual;routeOk=ok;spreadMs=spread;}
        static CalResult missing(String l){return new CalResult(l,-1,"not selected",true,0);}
    }

    private void runSynchronizedTest(){
        int ds=prefs.getInt("delay_system",0),dp=prefs.getInt("delay_phone",180),de=prefs.getInt("delay_extra",0);
        int phoneUsage=prefs.getInt("phone_route_usage",AudioAttributes.USAGE_MEDIA);
        AudioDeviceInfo phone=phoneSpeaker(),extra=chosenExtra();ArrayList<AudioTrack> tracks=new ArrayList<>();try{
            tracks.add(buildStaticTestTrack(null,ds,AudioAttributes.USAGE_MEDIA));
            if(phone!=null)tracks.add(buildStaticTestTrack(phone,dp,phoneUsage));
            if(extra!=null)tracks.add(buildStaticTestTrack(extra,de,AudioAttributes.USAGE_MEDIA));
            for(AudioTrack t:tracks)t.play();
            new Handler(getMainLooper()).postDelayed(()->{
                ArrayList<String> routes=new ArrayList<>();for(AudioTrack t:tracks)try{AudioDeviceInfo d=t.getRoutedDevice();routes.add(d==null?"unknown":deviceName(d));}catch(Throwable ignored){}
                toast("Actual test routes: "+String.join(" + ",routes));
            },260);
            toast("Listen for one tight click pattern. Auto calibration now verifies routes before calculating delay.");
            new Handler(getMainLooper()).postDelayed(()->{for(AudioTrack t:tracks)try{t.stop();t.release();}catch(Exception ignored){}},5200);
        }catch(Throwable t){for(AudioTrack x:tracks)try{x.release();}catch(Exception ignored){}toast("Sync test failed: "+t.getClass().getSimpleName());}
    }
    private AudioTrack buildStaticTestTrack(AudioDeviceInfo preferred,int delayMs,int usage){int rate=48000;short[] pcm=makePulsePattern(rate,delayMs,3200);AudioTrack t=new AudioTrack.Builder().setAudioAttributes(new AudioAttributes.Builder().setUsage(usage).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build()).setAudioFormat(new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(rate).setChannelMask(AudioFormat.CHANNEL_OUT_STEREO).build()).setBufferSizeInBytes(pcm.length*2).setTransferMode(AudioTrack.MODE_STATIC).build();if(preferred!=null)t.setPreferredDevice(preferred);t.setVolume(0.55f);t.write(pcm,0,pcm.length);return t;}
    private short[] makePulsePattern(int rate,int delayMs,int totalMs){int frames=rate*(totalMs+delayMs)/1000;short[] out=new short[frames*2];int delayFrames=rate*delayMs/1000;for(int i=delayFrames;i<frames;i++){double t=(double)(i-delayFrames)/rate;double cycle=t%0.55;double env=cycle<0.075?Math.sin(Math.PI*cycle/0.075):0;short v=(short)(Math.sin(2*Math.PI*850*t)*env*23000);out[i*2]=v;out[i*2+1]=v;}return out;}

    private void beginPandoraMirror(){
        if(Build.VERSION.SDK_INT<29){toast("Playback capture requires Android 10 or newer.");return;}
        if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},REQ_RECORD);pandoraStatus.setText("Microphone/audio-capture permission is required. After granting it, tap the Pandora mirror button again.");return;}
        new AlertDialog.Builder(this).setTitle("Safe Pandora mirror").setMessage("First make sure Pandora is already playing through the two JBLs in Samsung Media output. Android will show a screen-capture permission dialog because that is the only public API that can request playback audio. SyncLink will test Pandora silently first. If Pandora blocks capture, SyncLink stops without creating the phone/Sony tracks.").setNegativeButton("Cancel",null).setPositiveButton("Continue",(d,w)->requestProjection()).show();
    }
    private void requestProjection(){MediaProjectionManager mpm=getSystemService(MediaProjectionManager.class);if(mpm==null){toast("MediaProjection is unavailable.");return;}startActivityForResult(mpm.createScreenCaptureIntent(),REQ_CAPTURE);}
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){super.onActivityResult(requestCode,resultCode,data);if(requestCode!=REQ_CAPTURE)return;if(resultCode!=RESULT_OK||data==null){pandoraStatus.setText("Capture permission canceled. Your current audio route was not changed.");return;}Intent s=new Intent(this,PandoraMirrorServiceV5.class);s.putExtra("resultCode",resultCode);s.putExtra("resultData",data);if(Build.VERSION.SDK_INT>=26)startForegroundService(s);else startService(s);pandoraStatus.setText("Testing Pandora capture first… no extra output will start unless real audio is detected.");}
    private void stopPandoraMirror(){Intent s=new Intent(this,PandoraMirrorServiceV5.class).setAction(PandoraMirrorServiceV5.ACTION_STOP);if(Build.VERSION.SDK_INT>=26)startForegroundService(s);else startService(s);pandoraStatus.setText("Pandora mirror stopped.");}

    private void openSamsungMedia(){try{Intent i=new Intent("com.android.systemui.action.LAUNCH_SYSTEM_MEDIA_OUTPUT_DIALOG");i.setPackage("com.android.systemui");List<ResolveInfo> r=getPackageManager().queryBroadcastReceivers(i,0);if(r!=null&&!r.isEmpty()){sendBroadcast(i);return;}}catch(Throwable ignored){}if(Build.VERSION.SDK_INT>=34)try{if(MediaRouter2.getInstance(this).showSystemOutputSwitcher())return;}catch(Throwable ignored){}try{Intent panel=new Intent("com.android.settings.panel.action.MEDIA_OUTPUT");startActivity(panel);return;}catch(Exception ignored){}new AlertDialog.Builder(this).setTitle("Samsung Media output").setMessage("Swipe down from the top-right, tap Media output, and select the two JBL speakers.").setPositiveButton("OK",null).show();}
    private void openPandora(){try{Intent i=getPackageManager().getLaunchIntentForPackage("com.pandora.android");if(i!=null){startActivity(i);return;}startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("market://details?id=com.pandora.android")));}catch(Exception e){toast("Pandora isn't installed.");}}

    private void showTutorial(){new AlertDialog.Builder(this).setTitle("SyncLink v0.5.1").setMessage("We found the important distinction: CONNECTED does not mean Android will route two copies of the same audio where we ask.\n\n1. Samsung Dual Audio still handles two Bluetooth speakers.\n2. ‘Test Phone + Current Bluetooth’ now verifies whether SyncLink can independently route a second track to the built-in phone speaker.\n3. Auto Calibration only measures a route AFTER Android confirms the track really reached that route, and it uses three chirp passes with correlation instead of a single volume spike.\n4. If Samsung blocks the direct phone route, use Separate app sound: Pandora stays on Bluetooth while SyncLink’s captured mirror is assigned to This phone.\n\nThe delay controls now go to 1500 ms, but SyncLink will no longer pretend a delay can repair a routing failure.").setNegativeButton("Close",null).setPositiveButton("Got it",(d,w)->prefs.edit().putBoolean("tutorial_051",true).apply()).show();}

    @SuppressWarnings("deprecation")private BluetoothDevice deviceFrom(Intent i){if(i==null)return null;if(Build.VERSION.SDK_INT>=33)return i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE,BluetoothDevice.class);return i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);}
    private String norm(String s){return s==null?"":s.toLowerCase(Locale.US).replace("nick's","").replace("nick’s","").replaceAll("[^a-z0-9]","");}
    private boolean match(String a,String b){return!a.isEmpty()&&!b.isEmpty()&&(a.equals(b)||a.contains(b)||b.contains(a));}
    private String deviceName(AudioDeviceInfo d){String p=d.getProductName()==null?"":d.getProductName().toString();return p.trim().isEmpty()?"Audio device "+d.getId():p;}
    private String shortName(String s){return s==null?"Speaker":s.replace("Nick's ","").replace("Nick’s ","");}
    private void toast(String s){Toast.makeText(this,s,Toast.LENGTH_SHORT).show();}
    private LinearLayout col(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;}
    private LinearLayout row(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.HORIZONTAL);l.setGravity(Gravity.CENTER_VERTICAL);return l;}
    private LinearLayout card(int c,int r,int p){LinearLayout l=col();l.setPadding(dp(p),dp(p),dp(p),dp(p));l.setBackground(round(c,r));return l;}
    private TextView text(String s,int z,int c,boolean b){TextView v=new TextView(this);v.setText(s);v.setTextSize(z);v.setTextColor(c);v.setLineSpacing(0,1.12f);if(b)v.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return v;}
    private TextView pill(String s,int bg,int fg){TextView v=text(s,10,fg,true);v.setGravity(Gravity.CENTER);v.setPadding(dp(9),dp(5),dp(9),dp(5));v.setBackground(round(bg,100));return v;}
    private Button button(String s,int c){Button b=new Button(this);b.setText(s);b.setTextColor(Color.WHITE);b.setTextSize(12);b.setTypeface(Typeface.DEFAULT,Typeface.BOLD);b.setAllCaps(false);b.setBackground(round(c,15));b.setStateListAnimator(null);return b;}
    private Button outline(String s){Button b=button(s,Color.TRANSPARENT);b.setTextColor(Color.rgb(213,219,239));b.setBackground(stroke(Color.TRANSPARENT,Color.rgb(65,77,112),1,15));return b;}
    private GradientDrawable round(int c,int r){GradientDrawable d=new GradientDrawable();d.setColor(c);d.setCornerRadius(dp(r));return d;}
    private GradientDrawable stroke(int fill,int line,int width,int radius){GradientDrawable d=round(fill,radius);d.setStroke(dp(width),line);return d;}
    private View gap(int n){Space s=new Space(this);s.setLayoutParams(new LinearLayout.LayoutParams(1,dp(n)));return s;}
    private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}

    private static class Speaker{String address,name,type;BluetoothDevice device;boolean connected,bonded;int accent;}
}
