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
import android.media.AudioTrack;
import android.media.MediaRouter2;
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

public class MainActivityV3 extends Activity {
    private static final int REQ_BT = 9103;
    private static final int BG=Color.rgb(8,11,22), PANEL=Color.rgb(17,22,39), PANEL2=Color.rgb(24,30,52);
    private static final int TEXT=Color.rgb(244,246,255), MUTED=Color.rgb(155,165,192), PURPLE=Color.rgb(124,92,255);
    private static final int GREEN=Color.rgb(74,222,128), ORANGE=Color.rgb(255,145,77), AMBER=Color.rgb(251,191,36), CYAN=Color.rgb(65,210,245), DIM=Color.rgb(82,91,118);

    private BluetoothAdapter bt;
    private AudioManager audio;
    private SharedPreferences prefs;
    private BluetoothProfile a2dp, headset, leAudio;
    private final LinkedHashMap<String, Speaker> devices=new LinkedHashMap<>();
    private final HashSet<String> acl=new HashSet<>();
    private final ArrayList<String> liveOutputs=new ArrayList<>();
    private final ArrayList<AudioTrack> labTracks=new ArrayList<>();
    private LinearLayout deviceList;
    private TextView status, selectedLabel, labStatus;
    private Button labButton;

    private final BluetoothProfile.ServiceListener profileListener=new BluetoothProfile.ServiceListener(){
        @Override public void onServiceConnected(int profile,BluetoothProfile proxy){
            if(profile==BluetoothProfile.A2DP)a2dp=proxy;
            if(profile==BluetoothProfile.HEADSET)headset=proxy;
            if(Build.VERSION.SDK_INT>=31&&profile==BluetoothProfile.LE_AUDIO)leAudio=proxy;
            refresh();
        }
        @Override public void onServiceDisconnected(int profile){
            if(profile==BluetoothProfile.A2DP)a2dp=null;
            if(profile==BluetoothProfile.HEADSET)headset=null;
            if(Build.VERSION.SDK_INT>=31&&profile==BluetoothProfile.LE_AUDIO)leAudio=null;
            refresh();
        }
    };

    private final BroadcastReceiver receiver=new BroadcastReceiver(){
        @Override public void onReceive(Context c,Intent i){
            BluetoothDevice d=deviceFrom(i); String action=i.getAction();
            if(d!=null&&allowed())try{
                if(BluetoothDevice.ACTION_ACL_CONNECTED.equals(action))acl.add(d.getAddress());
                if(BluetoothDevice.ACTION_ACL_DISCONNECTED.equals(action))acl.remove(d.getAddress());
            }catch(SecurityException ignored){}
            refresh();
        }
    };

    @Override protected void onCreate(Bundle b){
        super.onCreate(b); getWindow().setStatusBarColor(BG); getWindow().setNavigationBarColor(BG);
        prefs=getSharedPreferences("synclink",MODE_PRIVATE);
        BluetoothManager bm=getSystemService(BluetoothManager.class); bt=bm==null?null:bm.getAdapter(); audio=getSystemService(AudioManager.class);
        setContentView(ui()); registerBt(); requestBt(); refresh();
        if(!prefs.getBoolean("tutorial_030",false))new Handler(getMainLooper()).postDelayed(this::tutorial,450);
    }
    @Override protected void onResume(){super.onResume();refresh();}
    @Override protected void onDestroy(){super.onDestroy(); stopLabTracks(); try{unregisterReceiver(receiver);}catch(Exception ignored){} if(bt!=null)try{if(a2dp!=null)bt.closeProfileProxy(BluetoothProfile.A2DP,a2dp);if(headset!=null)bt.closeProfileProxy(BluetoothProfile.HEADSET,headset);if(Build.VERSION.SDK_INT>=31&&leAudio!=null)bt.closeProfileProxy(BluetoothProfile.LE_AUDIO,leAudio);}catch(Exception ignored){} }

    private View ui(){
        ScrollView s=new ScrollView(this);s.setBackgroundColor(BG);s.setFillViewport(true);LinearLayout root=col();root.setPadding(dp(18),dp(20),dp(18),dp(44));s.addView(root);
        LinearLayout header=row();TextView logo=text("S",22,Color.WHITE,true);logo.setGravity(Gravity.CENTER);logo.setBackground(round(PURPLE,16));header.addView(logo,new LinearLayout.LayoutParams(dp(50),dp(50)));
        LinearLayout title=col();title.addView(text("SyncLink",28,TEXT,true));title.addView(text("Multi-output lab",13,MUTED,false));LinearLayout.LayoutParams tp=new LinearLayout.LayoutParams(0,-2,1);tp.leftMargin=dp(12);header.addView(title,tp);Button help=button("?",PANEL2);help.setOnClickListener(v->tutorial());header.addView(help,new LinearLayout.LayoutParams(dp(46),dp(46)));root.addView(header);root.addView(gap(16));

        LinearLayout st=card(Color.rgb(13,25,45),18,16);status=text("Checking connected outputs…",14,GREEN,true);st.addView(status);TextView h=text("Connection and playback routing are tested separately.",13,MUTED,false);h.setPadding(0,dp(6),0,0);st.addView(h);root.addView(st);root.addView(gap(24));

        root.addView(step("1","Connected speakers","Select every Bluetooth speaker you want SyncLink to test."));root.addView(gap(10));Button refresh=button("REFRESH CONNECTIONS",PANEL2);refresh.setOnClickListener(v->refresh());root.addView(refresh,new LinearLayout.LayoutParams(-1,dp(48)));deviceList=col();root.addView(deviceList);

        root.addView(gap(26));root.addView(step("2","Experimental multi-output test","This bypasses Samsung's normal output picker and tests app-owned AudioTracks directly."));root.addView(gap(10));
        LinearLayout lab=card(Color.rgb(15,25,42),18,16);CheckBox phone=new CheckBox(this);phone.setText("Include this phone's speaker");phone.setTextColor(TEXT);phone.setTextSize(14);phone.setChecked(prefs.getBoolean("lab_phone",true));phone.setButtonTintList(ColorStateList.valueOf(CYAN));phone.setOnCheckedChangeListener((b,on)->{if(b.isPressed())prefs.edit().putBoolean("lab_phone",on).apply();updateState();});lab.addView(phone);lab.addView(gap(8));
        selectedLabel=text("0 Bluetooth speakers selected",13,TEXT,true);lab.addView(selectedLabel);lab.addView(gap(12));labButton=button("RUN VERIFIED MULTI-OUTPUT TEST",PURPLE);labButton.setOnClickListener(v->runLabTest());lab.addView(labButton,new LinearLayout.LayoutParams(-1,dp(54)));lab.addView(gap(10));labStatus=text("SyncLink will request one output per track, then report the output Android actually used.",12,MUTED,false);lab.addView(labStatus);root.addView(lab);

        root.addView(gap(26));root.addView(step("3","Samsung Dual Audio","For normal apps like Pandora, Samsung still exposes its native two-Bluetooth-device route."));root.addView(gap(10));LinearLayout dual=card(PANEL,18,16);Button out=button("OPEN MEDIA OUTPUT",PANEL2);out.setOnClickListener(v->openOutput());dual.addView(out,new LinearLayout.LayoutParams(-1,dp(48)));dual.addView(gap(9));Button pandora=button("OPEN PANDORA",Color.rgb(36,120,255));pandora.setOnClickListener(v->openPandora());dual.addView(pandora,new LinearLayout.LayoutParams(-1,dp(48)));root.addView(dual);

        root.addView(gap(22));TextView ver=text("SyncLink v0.3.0 • experimental routing probe",12,DIM,false);ver.setGravity(Gravity.CENTER);root.addView(ver);return s;
    }

    private View step(String n,String title,String sub){LinearLayout r=row();r.setGravity(Gravity.TOP);TextView badge=text(n,13,Color.WHITE,true);badge.setGravity(Gravity.CENTER);badge.setBackground(round(PURPLE,100));r.addView(badge,new LinearLayout.LayoutParams(dp(30),dp(30)));LinearLayout c=col();c.addView(text(title,19,TEXT,true));TextView t=text(sub,13,MUTED,false);t.setPadding(0,dp(3),0,0);c.addView(t);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,-2,1);p.leftMargin=dp(10);r.addView(c,p);return r;}

    private void registerBt(){IntentFilter f=new IntentFilter();f.addAction(BluetoothDevice.ACTION_BOND_STATE_CHANGED);f.addAction(BluetoothDevice.ACTION_ACL_CONNECTED);f.addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED);f.addAction("android.bluetooth.a2dp.profile.action.CONNECTION_STATE_CHANGED");f.addAction(BluetoothHeadset.ACTION_CONNECTION_STATE_CHANGED);if(Build.VERSION.SDK_INT>=33)registerReceiver(receiver,f,Context.RECEIVER_EXPORTED);else registerReceiver(receiver,f);registerProfilesAgain();}
    private void registerProfilesAgain(){if(bt!=null&&allowed())try{bt.getProfileProxy(this,profileListener,BluetoothProfile.A2DP);bt.getProfileProxy(this,profileListener,BluetoothProfile.HEADSET);if(Build.VERSION.SDK_INT>=31)bt.getProfileProxy(this,profileListener,BluetoothProfile.LE_AUDIO);}catch(Exception ignored){}}
    private void requestBt(){ArrayList<String> m=new ArrayList<>();if(Build.VERSION.SDK_INT>=31){if(checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED)m.add(Manifest.permission.BLUETOOTH_CONNECT);if(checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)!=PackageManager.PERMISSION_GRANTED)m.add(Manifest.permission.BLUETOOTH_SCAN);}else if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)m.add(Manifest.permission.ACCESS_FINE_LOCATION);if(!m.isEmpty())requestPermissions(m.toArray(new String[0]),REQ_BT);}
    @Override public void onRequestPermissionsResult(int r,String[] p,int[] g){super.onRequestPermissionsResult(r,p,g);if(r==REQ_BT){registerProfilesAgain();refresh();}}
    private boolean allowed(){return Build.VERSION.SDK_INT<31||checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED;}

    private void refresh(){captureOutputs();if(bt!=null&&allowed())try{for(BluetoothDevice d:bt.getBondedDevices())upsert(d,connected(d));fromProfile(a2dp);fromProfile(headset);if(Build.VERSION.SDK_INT>=31)fromProfile(leAudio);for(Speaker x:devices.values()){x.connected=x.device!=null&&connected(x.device);if(!x.connected&&prefs.getBoolean("lab_sel_"+x.address,false))prefs.edit().putBoolean("lab_sel_"+x.address,false).apply();}}catch(SecurityException ignored){}render();}
    private void fromProfile(BluetoothProfile p){if(p==null||!allowed())return;try{for(BluetoothDevice d:p.getConnectedDevices())upsert(d,true);}catch(SecurityException ignored){}}
    private void upsert(BluetoothDevice d,boolean conn){if(d==null||!allowed())return;try{String a=d.getAddress();if(a==null)return;Speaker x=devices.get(a);if(x==null){x=new Speaker();x.address=a;devices.put(a,x);}x.device=d;String n=d.getName();x.name=n==null||n.trim().isEmpty()?"Unnamed Bluetooth device":n;x.connected=conn;x.bonded=d.getBondState()==BluetoothDevice.BOND_BONDED;classify(x);}catch(SecurityException ignored){}}
    private boolean connected(BluetoothDevice d){if(d==null||!allowed())return false;try{String a=d.getAddress();if(a!=null&&acl.contains(a))return true;if(a2dp!=null&&a2dp.getConnectionState(d)==BluetoothProfile.STATE_CONNECTED)return true;if(headset!=null&&headset.getConnectionState(d)==BluetoothProfile.STATE_CONNECTED)return true;if(Build.VERSION.SDK_INT>=31&&leAudio!=null&&leAudio.getConnectionState(d)==BluetoothProfile.STATE_CONNECTED)return true;try{Method m=BluetoothDevice.class.getMethod("isConnected",int.class);Object b=m.invoke(d,1);if(Boolean.TRUE.equals(b))return true;Object l=m.invoke(d,2);if(Boolean.TRUE.equals(l))return true;}catch(Throwable ignored){}String n=norm(d.getName());for(String o:liveOutputs)if(match(n,o))return true;}catch(SecurityException ignored){}return false;}
    private void captureOutputs(){liveOutputs.clear();if(audio==null)return;for(AudioDeviceInfo d:audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS)){CharSequence p=d.getProductName();if(p!=null)liveOutputs.add(norm(p.toString()));}}
    private void classify(Speaker x){String n=x.name.toLowerCase(Locale.US);x.accent=DIM;x.type="Bluetooth device";if(n.contains("partybox")&&n.contains("club 120")){x.accent=PURPLE;x.type="JBL PartyBox Club 120";}else if(n.contains("flip6")||n.contains("flip 6")){x.accent=ORANGE;x.type="JBL Flip 6";}else if(n.contains("charge 5")){x.accent=ORANGE;x.type="JBL Charge 5";}else if(n.contains("ht-ct370")||n.contains("ct370")){x.accent=AMBER;x.type="Sony HT-CT370";}else if(n.contains("jbl")){x.accent=ORANGE;x.type="JBL Bluetooth speaker";}else if(n.contains("sony")){x.accent=AMBER;x.type="Sony Bluetooth speaker";}}

    private void render(){if(deviceList==null)return;deviceList.removeAllViews();ArrayList<Speaker> list=new ArrayList<>(devices.values());Collections.sort(list,new Comparator<Speaker>(){public int compare(Speaker a,Speaker b){if(a.connected!=b.connected)return a.connected?-1:1;return a.name.compareToIgnoreCase(b.name);}});for(Speaker x:list){deviceList.addView(gap(8));deviceList.addView(cardFor(x));}updateState();}
    private View cardFor(Speaker x){boolean sel=x.connected&&prefs.getBoolean("lab_sel_"+x.address,false);LinearLayout card=card(PANEL,18,14);card.setAlpha(x.connected?1f:.48f);card.setBackground(stroke(PANEL,sel?x.accent:Color.rgb(43,51,76),sel?2:1,18));LinearLayout r=row();CheckBox cb=new CheckBox(this);cb.setChecked(sel);cb.setEnabled(x.connected);cb.setButtonTintList(ColorStateList.valueOf(x.connected?x.accent:DIM));r.addView(cb,new LinearLayout.LayoutParams(dp(46),dp(46)));LinearLayout tx=col();tx.addView(text(x.name,15,x.connected?TEXT:MUTED,true));tx.addView(text(x.type,12,x.connected?x.accent:DIM,true));tx.addView(text(x.connected?"Connected • eligible for lab test":"Paired • connect first",12,MUTED,false));LinearLayout.LayoutParams t=new LinearLayout.LayoutParams(0,-2,1);t.leftMargin=dp(4);r.addView(tx,t);r.addView(pill(x.connected?"CONNECTED":"PAIRED",x.connected?Color.rgb(18,68,43):Color.rgb(28,34,57),x.connected?GREEN:MUTED));card.addView(r);cb.setOnCheckedChangeListener((b,on)->{if(!b.isPressed())return;prefs.edit().putBoolean("lab_sel_"+x.address,on).apply();render();});card.setOnClickListener(v->{if(!x.connected){toast("Connect "+x.name+" first.");return;}prefs.edit().putBoolean("lab_sel_"+x.address,!prefs.getBoolean("lab_sel_"+x.address,false)).apply();render();});return card;}
    private int selectedBluetooth(){int n=0;for(Speaker x:devices.values())if(x.connected&&prefs.getBoolean("lab_sel_"+x.address,false))n++;return n;}
    private void updateState(){int c=0;ArrayList<String> n=new ArrayList<>();for(Speaker x:devices.values())if(x.connected){c++;if(n.size()<3)n.add(shortName(x.name));}if(status!=null)status.setText(c==0?"No Bluetooth speakers connected":c+" Bluetooth connected • "+String.join(" + ",n));int s=selectedBluetooth();if(selectedLabel!=null)selectedLabel.setText(s+(s==1?" Bluetooth speaker selected":" Bluetooth speakers selected"));if(labButton!=null){boolean any=s>0||prefs.getBoolean("lab_phone",true);labButton.setEnabled(any);labButton.setAlpha(any?1f:.45f);}}

    private void runLabTest(){
        stopLabTracks();
        ArrayList<RouteRequest> reqs=new ArrayList<>();
        AudioDeviceInfo phone=findPhoneSpeaker();
        if(prefs.getBoolean("lab_phone",true)){if(phone!=null)reqs.add(new RouteRequest("This phone",phone));else reqs.add(new RouteRequest("This phone",null));}
        for(Speaker x:devices.values())if(x.connected&&prefs.getBoolean("lab_sel_"+x.address,false))reqs.add(new RouteRequest(shortName(x.name),findOutputFor(x.name)));
        if(reqs.isEmpty()){toast("Select at least one output.");return;}
        short[] pcm=makeTonePcm(48000,2400);
        ArrayList<LabResult> results=new ArrayList<>();
        for(RouteRequest r:reqs){
            if(r.device==null){results.add(new LabResult(r.label,"NOT EXPOSED",false,null));continue;}
            try{
                AudioTrack t=new AudioTrack.Builder().setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build()).setAudioFormat(new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(48000).setChannelMask(AudioFormat.CHANNEL_OUT_STEREO).build()).setBufferSizeInBytes(pcm.length*2).setTransferMode(AudioTrack.MODE_STATIC).build();
                boolean preferred=t.setPreferredDevice(r.device);int wrote=t.write(pcm,0,pcm.length);if(wrote<=0){t.release();results.add(new LabResult(r.label,"WRITE FAILED",preferred,null));continue;}labTracks.add(t);results.add(new LabResult(r.label,"checking…",preferred,t));
            }catch(Throwable e){results.add(new LabResult(r.label,"ERROR: "+e.getClass().getSimpleName(),false,null));}
        }
        for(LabResult x:results)if(x.track!=null)try{x.track.play();}catch(Throwable ignored){}
        labStatus.setText("Playing synchronized test pattern… verifying real routes.");
        new Handler(getMainLooper()).postDelayed(()->{
            StringBuilder body=new StringBuilder();int distinct=0;HashSet<Integer> ids=new HashSet<>();
            for(LabResult x:results){
                if(x.track!=null){try{AudioDeviceInfo actual=x.track.getRoutedDevice();if(actual!=null){x.actual=deviceName(actual);ids.add(actual.getId());}else x.actual="NO ROUTE REPORTED";}catch(Throwable e){x.actual="ROUTE QUERY FAILED";}}
                body.append(x.label).append("\n  requested: ").append(x.preferredAccepted?"accepted":"not accepted").append("\n  actual: ").append(x.actual).append("\n\n");
            }
            distinct=ids.size();labStatus.setText("Verified "+distinct+" distinct routed output"+(distinct==1?"":"s")+" during the test.");
            body.append("Distinct real outputs: ").append(distinct).append("\n\nIf you physically heard the same pattern from more devices than listed, tell me—that means Samsung is mirroring below Android's per-track route report.");
            new AlertDialog.Builder(this).setTitle("Verified routing result").setMessage(body.toString()).setPositiveButton("Done",null).show();
        },700);
        new Handler(getMainLooper()).postDelayed(this::stopLabTracks,3000);
    }

    private short[] makeTonePcm(int rate,int ms){int frames=rate*ms/1000;short[] out=new short[frames*2];for(int i=0;i<frames;i++){double sec=(double)i/rate;double phaseInBeat=sec%0.6;double env=phaseInBeat<0.22?Math.sin(Math.PI*(phaseInBeat/0.22)):0.0;short v=(short)(Math.sin(2*Math.PI*660*sec)*env*21000);out[i*2]=v;out[i*2+1]=v;}return out;}
    private void stopLabTracks(){for(AudioTrack t:new ArrayList<>(labTracks))try{t.stop();t.flush();t.release();}catch(Throwable ignored){}labTracks.clear();}
    private AudioDeviceInfo findPhoneSpeaker(){if(audio==null)return null;for(AudioDeviceInfo d:audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS))if(d.getType()==AudioDeviceInfo.TYPE_BUILTIN_SPEAKER)return d;return null;}
    private AudioDeviceInfo findOutputFor(String speakerName){if(audio==null)return null;String n=norm(speakerName);AudioDeviceInfo best=null;for(AudioDeviceInfo d:audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS)){int type=d.getType();boolean btType=type==AudioDeviceInfo.TYPE_BLUETOOTH_A2DP||type==AudioDeviceInfo.TYPE_BLUETOOTH_SCO||type==AudioDeviceInfo.TYPE_BLE_HEADSET||type==AudioDeviceInfo.TYPE_BLE_SPEAKER||type==AudioDeviceInfo.TYPE_HEARING_AID;if(!btType)continue;String p=norm(d.getProductName()==null?"":d.getProductName().toString());if(match(n,p))return d;if(best==null)best=d;}return best!=null&&selectedBluetooth()==1?best:null;}
    private String deviceName(AudioDeviceInfo d){String p=d.getProductName()==null?"":d.getProductName().toString();if(p.trim().isEmpty())p=typeName(d.getType());return p+" [id "+d.getId()+"]";}
    private String typeName(int t){if(t==AudioDeviceInfo.TYPE_BUILTIN_SPEAKER)return"Phone speaker";if(t==AudioDeviceInfo.TYPE_BLUETOOTH_A2DP)return"Bluetooth A2DP";if(t==AudioDeviceInfo.TYPE_BLUETOOTH_SCO)return"Bluetooth SCO";if(t==AudioDeviceInfo.TYPE_BLE_HEADSET)return"BLE headset";if(t==AudioDeviceInfo.TYPE_BLE_SPEAKER)return"BLE speaker";return"Audio device";}

    private void openOutput(){try{Intent i=new Intent("com.android.systemui.action.LAUNCH_SYSTEM_MEDIA_OUTPUT_DIALOG");i.setPackage("com.android.systemui");List<ResolveInfo> r=getPackageManager().queryBroadcastReceivers(i,0);if(r!=null&&!r.isEmpty()){sendBroadcast(i);return;}}catch(Throwable ignored){}if(Build.VERSION.SDK_INT>=34)try{if(MediaRouter2.getInstance(this).showSystemOutputSwitcher())return;}catch(Throwable ignored){}toast("Samsung Media output could not be opened directly.");}
    private void openPandora(){try{Intent i=getPackageManager().getLaunchIntentForPackage("com.pandora.android");if(i!=null){startActivity(i);return;}startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("market://details?id=com.pandora.android")));}catch(Exception e){toast("Pandora isn't installed.");}}
    private void tutorial(){new AlertDialog.Builder(this).setTitle("v0.3 Multi-output Lab").setMessage("Your phone can keep three Bluetooth speakers connected, but Samsung's normal Dual Audio UI only sends media to two.\n\nThis lab tests a different path: SyncLink creates its own synchronized audio tracks, requests a specific physical output for each track, and then asks Android where each track actually went.\n\nSelect the Flip, PartyBox and Sony, keep 'This phone' enabled, then run the verified test. Listen carefully and send me the result dialog.").setNegativeButton("Close",null).setPositiveButton("Got it",(d,w)->prefs.edit().putBoolean("tutorial_030",true).apply()).show();}

    @SuppressWarnings("deprecation")private BluetoothDevice deviceFrom(Intent i){if(i==null)return null;if(Build.VERSION.SDK_INT>=33)return i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE,BluetoothDevice.class);return i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);}
    private String norm(String s){return s==null?"":s.toLowerCase(Locale.US).replace("nick's","").replace("nick’s","").replaceAll("[^a-z0-9]","");}
    private boolean match(String a,String b){return!a.isEmpty()&&!b.isEmpty()&&(a.equals(b)||a.contains(b)||b.contains(a));}
    private String shortName(String s){return s==null?"Speaker":s.replace("Nick's ","").replace("Nick’s ","");}
    private void toast(String s){Toast.makeText(this,s,Toast.LENGTH_SHORT).show();}
    private LinearLayout col(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;}
    private LinearLayout row(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.HORIZONTAL);l.setGravity(Gravity.CENTER_VERTICAL);return l;}
    private LinearLayout card(int c,int r,int p){LinearLayout l=col();l.setPadding(dp(p),dp(p),dp(p),dp(p));l.setBackground(round(c,r));return l;}
    private TextView text(String s,int z,int c,boolean b){TextView v=new TextView(this);v.setText(s);v.setTextSize(z);v.setTextColor(c);v.setLineSpacing(0,1.12f);if(b)v.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return v;}
    private TextView pill(String s,int bg,int fg){TextView v=text(s,10,fg,true);v.setGravity(Gravity.CENTER);v.setPadding(dp(9),dp(5),dp(9),dp(5));v.setBackground(round(bg,100));return v;}
    private Button button(String s,int c){Button b=new Button(this);b.setText(s);b.setTextColor(Color.WHITE);b.setTextSize(12);b.setTypeface(Typeface.DEFAULT,Typeface.BOLD);b.setAllCaps(false);b.setBackground(round(c,15));b.setStateListAnimator(null);return b;}
    private GradientDrawable round(int c,int r){GradientDrawable d=new GradientDrawable();d.setColor(c);d.setCornerRadius(dp(r));return d;}
    private GradientDrawable stroke(int fill,int line,int width,int radius){GradientDrawable d=round(fill,radius);d.setStroke(dp(width),line);return d;}
    private View gap(int n){Space s=new Space(this);s.setLayoutParams(new LinearLayout.LayoutParams(1,dp(n)));return s;}
    private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}

    private static class Speaker{String address,name,type;BluetoothDevice device;boolean connected,bonded;int accent;}
    private static class RouteRequest{String label;AudioDeviceInfo device;RouteRequest(String l,AudioDeviceInfo d){label=l;device=d;}}
    private static class LabResult{String label,actual;boolean preferredAccepted;AudioTrack track;LabResult(String l,String a,boolean p,AudioTrack t){label=l;actual=a;preferredAccepted=p;track=t;}}
}
