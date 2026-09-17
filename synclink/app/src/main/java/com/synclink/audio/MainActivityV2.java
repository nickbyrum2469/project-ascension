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
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.media.MediaRouter2;
import android.media.ToneGenerator;
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

public class MainActivityV2 extends Activity {
    private static final int REQ_BT = 9102;
    private static final int BG = Color.rgb(8,11,22), PANEL = Color.rgb(17,22,39), PANEL2 = Color.rgb(24,30,52);
    private static final int TEXT = Color.rgb(244,246,255), MUTED = Color.rgb(155,165,192), PURPLE = Color.rgb(124,92,255);
    private static final int GREEN = Color.rgb(74,222,128), ORANGE = Color.rgb(255,145,77), DIM = Color.rgb(82,91,118);

    private BluetoothAdapter bt;
    private AudioManager audio;
    private SharedPreferences prefs;
    private BluetoothProfile a2dp, headset, leAudio;
    private final LinkedHashMap<String, Speaker> devices = new LinkedHashMap<>();
    private final HashSet<String> acl = new HashSet<>();
    private final ArrayList<String> liveOutputs = new ArrayList<>();

    private LinearLayout deviceList;
    private TextView status, selectedLabel;
    private Button startButton;

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

    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) {
            BluetoothDevice d = deviceFrom(i);
            String action = i.getAction();
            if (d != null && allowed()) {
                try {
                    if (BluetoothDevice.ACTION_ACL_CONNECTED.equals(action)) acl.add(d.getAddress());
                    if (BluetoothDevice.ACTION_ACL_DISCONNECTED.equals(action)) acl.remove(d.getAddress());
                } catch (SecurityException ignored) {}
            }
            refresh();
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
        setContentView(ui());
        registerBt();
        requestBt();
        refresh();
        if (!prefs.getBoolean("tutorial_022", false)) new Handler(getMainLooper()).postDelayed(this::tutorial, 400);
    }

    @Override protected void onResume() { super.onResume(); refresh(); }

    @Override protected void onDestroy() {
        super.onDestroy();
        try { unregisterReceiver(receiver); } catch (Exception ignored) {}
        if (bt != null) try {
            if (a2dp != null) bt.closeProfileProxy(BluetoothProfile.A2DP, a2dp);
            if (headset != null) bt.closeProfileProxy(BluetoothProfile.HEADSET, headset);
            if (Build.VERSION.SDK_INT >= 31 && leAudio != null) bt.closeProfileProxy(BluetoothProfile.LE_AUDIO, leAudio);
        } catch (Exception ignored) {}
    }

    private View ui() {
        ScrollView s = new ScrollView(this); s.setBackgroundColor(BG); s.setFillViewport(true);
        LinearLayout root = col(); root.setPadding(dp(18),dp(20),dp(18),dp(40)); s.addView(root);

        LinearLayout header = row();
        TextView logo = text("S",22,Color.WHITE,true); logo.setGravity(Gravity.CENTER); logo.setBackground(round(PURPLE,16));
        header.addView(logo,new LinearLayout.LayoutParams(dp(50),dp(50)));
        LinearLayout title = col(); title.addView(text("SyncLink",28,TEXT,true)); title.addView(text("Two speakers. One stream.",13,MUTED,false));
        LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(0,-2,1); tp.leftMargin=dp(12); header.addView(title,tp);
        Button help = button("?",PANEL2); help.setOnClickListener(v->tutorial()); header.addView(help,new LinearLayout.LayoutParams(dp(46),dp(46)));
        root.addView(header); root.addView(gap(16));

        LinearLayout state = card(Color.rgb(13,25,45),18,16);
        status = text("Checking Bluetooth…",14,GREEN,true); state.addView(status);
        TextView hint = text("Only truly connected speakers can be selected.",13,MUTED,false); hint.setPadding(0,dp(6),0,0); state.addView(hint);
        root.addView(state); root.addView(gap(24));

        root.addView(step("1","Choose connected speakers","Paired-only devices are locked. Select up to two connected speakers."));
        root.addView(gap(10));
        Button refresh = button("REFRESH CONNECTIONS",PANEL2); refresh.setOnClickListener(v->refresh()); root.addView(refresh,new LinearLayout.LayoutParams(-1,dp(48)));
        deviceList = col(); root.addView(deviceList);

        root.addView(gap(26)); root.addView(step("2","Start Dual Audio","SyncLink opens Samsung's Media output panel. Check both speakers there.")); root.addView(gap(10));
        LinearLayout party = card(PANEL,18,16);
        selectedLabel = text("0 selected",14,TEXT,true); party.addView(selectedLabel); party.addView(gap(12));
        startButton = button("START DUAL AUDIO",PURPLE); startButton.setOnClickListener(v->startDual()); party.addView(startButton,new LinearLayout.LayoutParams(-1,dp(52)));
        party.addView(gap(9));
        Button output = outline("OPEN MEDIA OUTPUT"); output.setOnClickListener(v->openOutput()); party.addView(output,new LinearLayout.LayoutParams(-1,dp(46)));
        party.addView(gap(9));
        Button test = outline("TEST BOTH SPEAKERS"); test.setOnClickListener(v->testTone()); party.addView(test,new LinearLayout.LayoutParams(-1,dp(46)));
        TextView note = text("When Samsung Media output opens, tick the circle beside both JBL speakers. Then Test Both Speakers should beep through both.",12,MUTED,false); note.setPadding(0,dp(10),0,0); party.addView(note);
        root.addView(party);

        root.addView(gap(26)); root.addView(step("3","Play music","Once Dual Audio is set, Pandora and other media apps use the same two outputs.")); root.addView(gap(10));
        LinearLayout music = card(Color.rgb(24,19,40),18,16);
        music.addView(text("Pandora",16,TEXT,true)); music.addView(text("Your stations and account stay in the normal Pandora app.",12,MUTED,false)); music.addView(gap(12));
        Button pandora = button("OPEN PANDORA",Color.rgb(36,120,255)); pandora.setOnClickListener(v->openPandora()); music.addView(pandora,new LinearLayout.LayoutParams(-1,dp(50)));
        root.addView(music); root.addView(gap(22));
        TextView ver = text("SyncLink v0.2.2",12,DIM,false); ver.setGravity(Gravity.CENTER); root.addView(ver);
        return s;
    }

    private View step(String n,String title,String sub) {
        LinearLayout r=row(); r.setGravity(Gravity.TOP);
        TextView badge=text(n,13,Color.WHITE,true); badge.setGravity(Gravity.CENTER); badge.setBackground(round(PURPLE,100)); r.addView(badge,new LinearLayout.LayoutParams(dp(30),dp(30)));
        LinearLayout c=col(); c.addView(text(title,19,TEXT,true)); TextView st=text(sub,13,MUTED,false); st.setPadding(0,dp(3),0,0); c.addView(st);
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,-2,1); p.leftMargin=dp(10); r.addView(c,p); return r;
    }

    private void registerBt() {
        IntentFilter f=new IntentFilter();
        f.addAction(BluetoothDevice.ACTION_BOND_STATE_CHANGED); f.addAction(BluetoothDevice.ACTION_ACL_CONNECTED); f.addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED);
        f.addAction("android.bluetooth.a2dp.profile.action.CONNECTION_STATE_CHANGED"); f.addAction(BluetoothHeadset.ACTION_CONNECTION_STATE_CHANGED);
        if (Build.VERSION.SDK_INT>=33) registerReceiver(receiver,f,Context.RECEIVER_EXPORTED); else registerReceiver(receiver,f);
        if (bt!=null && allowed()) try {
            bt.getProfileProxy(this,profileListener,BluetoothProfile.A2DP); bt.getProfileProxy(this,profileListener,BluetoothProfile.HEADSET);
            if (Build.VERSION.SDK_INT>=31) bt.getProfileProxy(this,profileListener,BluetoothProfile.LE_AUDIO);
        } catch(Exception ignored) {}
    }

    private void requestBt() {
        ArrayList<String> m=new ArrayList<>();
        if(Build.VERSION.SDK_INT>=31){
            if(checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED)m.add(Manifest.permission.BLUETOOTH_CONNECT);
            if(checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)!=PackageManager.PERMISSION_GRANTED)m.add(Manifest.permission.BLUETOOTH_SCAN);
        } else if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)m.add(Manifest.permission.ACCESS_FINE_LOCATION);
        if(!m.isEmpty())requestPermissions(m.toArray(new String[0]),REQ_BT);
    }

    @Override public void onRequestPermissionsResult(int r,String[] p,int[] g){ super.onRequestPermissionsResult(r,p,g); if(r==REQ_BT){ registerProfilesAgain(); refresh(); } }
    private void registerProfilesAgain(){ if(bt!=null&&allowed())try{ bt.getProfileProxy(this,profileListener,BluetoothProfile.A2DP); bt.getProfileProxy(this,profileListener,BluetoothProfile.HEADSET); if(Build.VERSION.SDK_INT>=31)bt.getProfileProxy(this,profileListener,BluetoothProfile.LE_AUDIO);}catch(Exception ignored){} }
    private boolean allowed(){ return Build.VERSION.SDK_INT<31 || checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED; }

    private void refresh() {
        captureOutputs();
        if(bt!=null&&allowed())try{
            Set<BluetoothDevice> bonded=bt.getBondedDevices();
            for(BluetoothDevice d:bonded) upsert(d,connected(d));
            fromProfile(a2dp); fromProfile(headset); if(Build.VERSION.SDK_INT>=31)fromProfile(leAudio);
            for(Speaker x:devices.values()){
                x.connected=x.device!=null&&connected(x.device);
                if(!x.connected&&prefs.getBoolean("sel_"+x.address,false))prefs.edit().putBoolean("sel_"+x.address,false).apply();
            }
        }catch(SecurityException ignored){}
        render();
    }

    private void fromProfile(BluetoothProfile p){ if(p==null||!allowed())return; try{for(BluetoothDevice d:p.getConnectedDevices())upsert(d,true);}catch(SecurityException ignored){} }
    private void upsert(BluetoothDevice d,boolean conn){
        if(d==null||!allowed())return; try{
            String a=d.getAddress(); if(a==null)return; Speaker x=devices.get(a); if(x==null){x=new Speaker();x.address=a;devices.put(a,x);} x.device=d;
            String n=d.getName(); x.name=n==null||n.trim().isEmpty()?"Unnamed Bluetooth device":n; x.connected=conn; x.bonded=d.getBondState()==BluetoothDevice.BOND_BONDED; classify(x);
        }catch(SecurityException ignored){}
    }

    private boolean connected(BluetoothDevice d){
        if(d==null||!allowed())return false; try{
            String a=d.getAddress(); if(a!=null&&acl.contains(a))return true;
            if(a2dp!=null&&a2dp.getConnectionState(d)==BluetoothProfile.STATE_CONNECTED)return true;
            if(headset!=null&&headset.getConnectionState(d)==BluetoothProfile.STATE_CONNECTED)return true;
            if(Build.VERSION.SDK_INT>=31&&leAudio!=null&&leAudio.getConnectionState(d)==BluetoothProfile.STATE_CONNECTED)return true;
            try{Method m=BluetoothDevice.class.getMethod("isConnected",int.class); Object b=m.invoke(d,1); if(Boolean.TRUE.equals(b))return true; Object l=m.invoke(d,2); if(Boolean.TRUE.equals(l))return true;}catch(Throwable ignored){}
            String n=norm(d.getName()); for(String o:liveOutputs)if(match(n,o))return true;
        }catch(SecurityException ignored){} return false;
    }

    private void captureOutputs(){
        liveOutputs.clear(); if(audio==null)return;
        for(AudioDeviceInfo d:audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS)){
            int t=d.getType();
            if(t==AudioDeviceInfo.TYPE_BLUETOOTH_A2DP||t==AudioDeviceInfo.TYPE_BLUETOOTH_SCO||t==AudioDeviceInfo.TYPE_BLE_HEADSET||t==AudioDeviceInfo.TYPE_BLE_SPEAKER||t==AudioDeviceInfo.TYPE_HEARING_AID){
                CharSequence p=d.getProductName(); if(p!=null)liveOutputs.add(norm(p.toString()));
            }
        }
    }

    private void classify(Speaker x){
        String n=x.name.toLowerCase(Locale.US); x.accent=DIM; x.type="Bluetooth device";
        if(n.contains("partybox")&&n.contains("club 120")){x.accent=PURPLE;x.type="JBL PartyBox Club 120";}
        else if(n.contains("flip6")||n.contains("flip 6")){x.accent=ORANGE;x.type="JBL Flip 6";}
        else if(n.contains("charge 5")){x.accent=ORANGE;x.type="JBL Charge 5";}
        else if(n.contains("jbl")){x.accent=ORANGE;x.type="JBL Bluetooth speaker";}
        else if(n.contains("ht-ct370")||n.contains("ct370")){x.accent=Color.rgb(251,191,36);x.type="Sony HT-CT370";}
    }

    private void render(){
        if(deviceList==null)return; deviceList.removeAllViews();
        ArrayList<Speaker> list=new ArrayList<>(devices.values()); Collections.sort(list,new Comparator<Speaker>(){public int compare(Speaker a,Speaker b){if(a.connected!=b.connected)return a.connected?-1:1;return a.name.compareToIgnoreCase(b.name);}});
        for(Speaker x:list){deviceList.addView(gap(8));deviceList.addView(cardFor(x));}
        updateState();
    }

    private View cardFor(Speaker x){
        boolean sel=x.connected&&prefs.getBoolean("sel_"+x.address,false);
        LinearLayout card=card(PANEL,18,14); card.setAlpha(x.connected?1f:.52f); card.setBackground(stroke(PANEL,sel?x.accent:Color.rgb(43,51,76),sel?2:1,18));
        LinearLayout r=row();
        CheckBox cb=new CheckBox(this); cb.setChecked(sel); cb.setEnabled(x.connected); cb.setButtonTintList(ColorStateList.valueOf(x.connected?x.accent:DIM)); r.addView(cb,new LinearLayout.LayoutParams(dp(46),dp(46)));
        LinearLayout tx=col(); tx.addView(text(x.name,15,x.connected?TEXT:MUTED,true)); tx.addView(text(x.type,12,x.connected?x.accent:DIM,true)); tx.addView(text(x.connected?"Connected to this phone":"Paired • connect first",12,MUTED,false));
        LinearLayout.LayoutParams t=new LinearLayout.LayoutParams(0,-2,1); t.leftMargin=dp(4); r.addView(tx,t); r.addView(pill(x.connected?"CONNECTED":"PAIRED",x.connected?Color.rgb(18,68,43):Color.rgb(28,34,57),x.connected?GREEN:MUTED)); card.addView(r);
        cb.setOnCheckedChangeListener((b,on)->{if(!b.isPressed())return;if(on&&selected()>=2){b.setChecked(false);toast("Dual Audio can use two direct Bluetooth speakers at once.");return;}prefs.edit().putBoolean("sel_"+x.address,on).apply();render();});
        card.setOnClickListener(v->{if(!x.connected){new AlertDialog.Builder(this).setTitle("Not connected").setMessage(x.name+" is paired but not connected. Connect it first, then come back to SyncLink.").setNegativeButton("Close",null).setPositiveButton("Open Bluetooth",(d,w)->openBluetooth()).show();return;}boolean on=!prefs.getBoolean("sel_"+x.address,false);if(on&&selected()>=2){toast("Dual Audio can use two direct Bluetooth speakers at once.");return;}prefs.edit().putBoolean("sel_"+x.address,on).apply();render();});
        return card;
    }

    private int selected(){int n=0;for(Speaker x:devices.values())if(x.connected&&prefs.getBoolean("sel_"+x.address,false))n++;return n;}
    private void updateState(){
        int c=0;ArrayList<String> names=new ArrayList<>();for(Speaker x:devices.values())if(x.connected){c++;if(names.size()<2)names.add(shortName(x.name));}
        if(status!=null){if(c==0)status.setText("No Bluetooth speakers connected");else if(c==1)status.setText("1 connected • "+names.get(0));else status.setText(c+" connected • "+names.get(0)+" + "+names.get(1));}
        int s=selected();if(selectedLabel!=null)selectedLabel.setText(s+" selected");if(startButton!=null){startButton.setEnabled(s>0);startButton.setAlpha(s>0?1f:.45f);}
    }

    private void startDual(){if(selected()==0){toast("Select a connected speaker first.");return;}openOutput();}
    private void openOutput(){
        try{Intent i=new Intent("com.android.systemui.action.LAUNCH_SYSTEM_MEDIA_OUTPUT_DIALOG");i.setPackage("com.android.systemui");List<ResolveInfo> r=getPackageManager().queryBroadcastReceivers(i,0);if(r!=null&&!r.isEmpty()){sendBroadcast(i);return;}}catch(Throwable ignored){}
        if(Build.VERSION.SDK_INT>=34)try{if(MediaRouter2.getInstance(this).showSystemOutputSwitcher())return;}catch(Throwable ignored){}
        new AlertDialog.Builder(this).setTitle("Samsung Media output").setMessage("Swipe down Quick Settings, tap Media output, then check both connected speakers. SyncLink could not open that Samsung system panel directly on this build.").setPositiveButton("Got it",null).show();
    }

    private void testTone(){try{ToneGenerator t=new ToneGenerator(AudioManager.STREAM_MUSIC,85);t.startTone(ToneGenerator.TONE_PROP_BEEP2,900);new Handler(getMainLooper()).postDelayed(t::release,1200);toast("You should hear this on every checked Media output.");}catch(Exception e){toast("Couldn't play test tone.");}}
    private void openPandora(){try{Intent i=getPackageManager().getLaunchIntentForPackage("com.pandora.android");if(i!=null){startActivity(i);return;}startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.pandora.android")));}catch(Exception e){toast("Pandora isn't installed.");}}
    private void openBluetooth(){try{startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS));}catch(Exception e){startActivity(new Intent(Settings.ACTION_SETTINGS));}}

    private void tutorial(){new AlertDialog.Builder(this).setTitle("How SyncLink works").setMessage("1. Connect both speakers to the phone.\n\n2. SyncLink only lets CONNECTED speakers be selected.\n\n3. Select two and tap Start Dual Audio.\n\n4. In Samsung Media output, check both speakers.\n\n5. Test them, then open Pandora.\n\nThe Samsung Media output checkboxes are system controls, so Android keeps final control of that step.").setNegativeButton("Close",null).setPositiveButton("Got it",(d,w)->prefs.edit().putBoolean("tutorial_022",true).apply()).show();}

    @SuppressWarnings("deprecation") private BluetoothDevice deviceFrom(Intent i){if(i==null)return null;if(Build.VERSION.SDK_INT>=33)return i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE,BluetoothDevice.class);return i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);}
    private String norm(String s){return s==null?"":s.toLowerCase(Locale.US).replace("nick's","").replace("nick’s","").replace(" ","").replace("-","").replace("_","").trim();}
    private boolean match(String a,String b){return !a.isEmpty()&&!b.isEmpty()&&(a.equals(b)||a.contains(b)||b.contains(a));}
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
