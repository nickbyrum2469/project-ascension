package com.synclink.audio;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.Space;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public class MainActivity extends Activity {

    private static final int REQ_BT = 9101;
    private static final int BG = Color.rgb(8, 11, 22);
    private static final int PANEL = Color.rgb(17, 22, 39);
    private static final int PANEL_2 = Color.rgb(22, 28, 49);
    private static final int TEXT = Color.rgb(244, 246, 255);
    private static final int MUTED = Color.rgb(157, 167, 194);
    private static final int PURPLE = Color.rgb(124, 92, 255);
    private static final int CYAN = Color.rgb(54, 214, 255);
    private static final int GREEN = Color.rgb(74, 222, 128);
    private static final int AMBER = Color.rgb(251, 191, 36);

    private BluetoothAdapter bluetoothAdapter;
    private AudioManager audioManager;
    private SharedPreferences prefs;
    private LinearLayout deviceContainer;
    private TextView scanStatus;
    private TextView selectedCount;
    private TextView activeRoute;
    private TextView capabilityLine;
    private Button scanButton;
    private ProgressBar scanProgress;

    private final LinkedHashMap<String, SpeakerDevice> speakers = new LinkedHashMap<>();
    private final LinkedHashMap<String, CheckBox> selectionBoxes = new LinkedHashMap<>();
    private BluetoothProfile a2dpProfile;
    private BluetoothProfile leAudioProfile;

    private final BluetoothProfile.ServiceListener profileListener = new BluetoothProfile.ServiceListener() {
        @Override public void onServiceConnected(int profile, BluetoothProfile proxy) {
            if (profile == BluetoothProfile.A2DP) a2dpProfile = proxy;
            if (Build.VERSION.SDK_INT >= 31 && profile == BluetoothProfile.LE_AUDIO) leAudioProfile = proxy;
            refreshRoutesAndDevices();
        }

        @Override public void onServiceDisconnected(int profile) {
            if (profile == BluetoothProfile.A2DP) a2dpProfile = null;
            if (Build.VERSION.SDK_INT >= 31 && profile == BluetoothProfile.LE_AUDIO) leAudioProfile = null;
            refreshRoutesAndDevices();
        }
    };

    private final AudioDeviceCallback audioDeviceCallback = new AudioDeviceCallback() {
        @Override public void onAudioDevicesAdded(AudioDeviceInfo[] addedDevices) { refreshRoutesAndDevices(); }
        @Override public void onAudioDevicesRemoved(AudioDeviceInfo[] removedDevices) { refreshRoutesAndDevices(); }
    };

    private final BroadcastReceiver bluetoothReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                BluetoothDevice device = getBluetoothDevice(intent);
                if (device != null) addBluetoothDevice(device, false, true);
            } else if (BluetoothAdapter.ACTION_DISCOVERY_STARTED.equals(action)) {
                setScanning(true, "Scanning nearby Bluetooth speakers…");
            } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(action)) {
                setScanning(false, speakers.isEmpty() ? "No speakers found yet. Put them in pairing mode and scan again." : "Scan complete • tap a speaker to include it");
            } else if (BluetoothDevice.ACTION_BOND_STATE_CHANGED.equals(action)) {
                refreshRoutesAndDevices();
            }
        }
    };

    @SuppressWarnings("deprecation")
    private BluetoothDevice getBluetoothDevice(Intent intent) {
        if (Build.VERSION.SDK_INT >= 33) return intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice.class);
        return intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
    }

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        prefs = getSharedPreferences("synclink", MODE_PRIVATE);
        BluetoothManager bm = getSystemService(BluetoothManager.class);
        bluetoothAdapter = bm != null ? bm.getAdapter() : null;
        audioManager = getSystemService(AudioManager.class);
        setContentView(buildUi());
        registerSystemListeners();
        requestBluetoothPermissionsIfNeeded();
        refreshRoutesAndDevices();
    }

    @Override protected void onResume() {
        super.onResume();
        refreshRoutesAndDevices();
    }

    @Override protected void onDestroy() {
        super.onDestroy();
        try { unregisterReceiver(bluetoothReceiver); } catch (Exception ignored) {}
        if (audioManager != null) audioManager.unregisterAudioDeviceCallback(audioDeviceCallback);
        if (bluetoothAdapter != null) {
            try {
                if (a2dpProfile != null) bluetoothAdapter.closeProfileProxy(BluetoothProfile.A2DP, a2dpProfile);
                if (Build.VERSION.SDK_INT >= 31 && leAudioProfile != null) bluetoothAdapter.closeProfileProxy(BluetoothProfile.LE_AUDIO, leAudioProfile);
            } catch (Exception ignored) {}
        }
    }

    private View buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(BG);
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(18), dp(22), dp(18), dp(42));
        scroll.addView(content, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        content.addView(buildHeader());
        content.addView(space(18));
        content.addView(buildHero());
        content.addView(space(22));
        content.addView(sectionTitle("YOUR SETUP", "Built around the three speakers you have right now"));
        content.addView(space(10));
        content.addView(gearCard("JBL PARTYBOX", "New-generation PartyBox", "Auracast on supported current models • exact model detected when paired", PURPLE));
        content.addView(space(8));
        content.addView(gearCard("JBL FLIP 6", "PartyBoost generation", "Great speaker • needs Relay mode for cross-brand multi-speaker sync", CYAN));
        content.addView(space(8));
        content.addView(gearCard("SONY HT-CT370", "Legacy Bluetooth soundbar", "A2DP output • direct single route or Relay mode", AMBER));

        content.addView(space(24));
        content.addView(sectionTitle("FIND SPEAKERS", "Paired devices show instantly; scan finds nearby devices in pairing mode"));
        content.addView(space(10));
        content.addView(buildScanActions());
        content.addView(space(10));
        LinearLayout scanLine = new LinearLayout(this);
        scanLine.setOrientation(LinearLayout.HORIZONTAL);
        scanLine.setGravity(Gravity.CENTER_VERTICAL);
        scanProgress = new ProgressBar(this);
        scanProgress.setIndeterminate(true);
        scanProgress.setVisibility(View.GONE);
        scanLine.addView(scanProgress, new LinearLayout.LayoutParams(dp(22), dp(22)));
        scanStatus = label("Ready to scan", 13, MUTED, false);
        LinearLayout.LayoutParams scanTextLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        scanTextLp.leftMargin = dp(8);
        scanLine.addView(scanStatus, scanTextLp);
        content.addView(scanLine);
        deviceContainer = new LinearLayout(this);
        deviceContainer.setOrientation(LinearLayout.VERTICAL);
        content.addView(deviceContainer);

        content.addView(space(24));
        content.addView(sectionTitle("PARTY CONTROL", "SyncLink builds the best route Android can actually support"));
        content.addView(space(10));
        content.addView(buildPartyPanel());
        content.addView(space(16));
        content.addView(buildRelayPanel());
        content.addView(space(20));
        TextView footer = label("SyncLink v0.1 • capability-first prototype • no fake multi-output claims", 12, Color.rgb(105, 116, 146), false);
        footer.setGravity(Gravity.CENTER);
        content.addView(footer);
        return root;
    }

    private View buildHeader() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        TextView logo = label("S", 22, Color.WHITE, true);
        logo.setGravity(Gravity.CENTER);
        logo.setBackground(roundRect(PURPLE, 16));
        row.addView(logo, new LinearLayout.LayoutParams(dp(48), dp(48)));
        LinearLayout titles = new LinearLayout(this);
        titles.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams tlp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        tlp.leftMargin = dp(12);
        row.addView(titles, tlp);
        titles.addView(label("SyncLink", 28, TEXT, true));
        titles.addView(label("One room. Every speaker.", 13, MUTED, false));
        row.addView(pill("BETA", PURPLE, Color.WHITE));
        return row;
    }

    private View buildHero() {
        LinearLayout card = panel(PANEL, 22, dp(18));
        card.setBackground(gradientPanel());
        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.addView(label("●", 13, GREEN, true));
        top.addView(label("  READY TO MAP YOUR AUDIO", 12, GREEN, true));
        card.addView(top);
        card.addView(space(10));
        card.addView(label("Build one party from whatever your speakers can actually do.", 22, TEXT, true));
        card.addView(space(7));
        card.addView(label("SyncLink detects classic Bluetooth, current audio routes and LE Audio capability, then separates direct playback from speakers that need Relay mode.", 14, MUTED, false));
        card.addView(space(14));
        capabilityLine = label("Checking phone audio capabilities…", 12, CYAN, true);
        capabilityLine.setPadding(dp(12), dp(9), dp(12), dp(9));
        capabilityLine.setBackground(roundRect(Color.rgb(13, 37, 52), 12));
        card.addView(capabilityLine);
        return card;
    }

    private View buildScanActions() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        scanButton = actionButton("SCAN SPEAKERS", PURPLE);
        scanButton.setOnClickListener(v -> startBluetoothScan());
        row.addView(scanButton, new LinearLayout.LayoutParams(0, dp(50), 1f));
        row.addView(new Space(this), new LinearLayout.LayoutParams(dp(10), 1));
        Button settingsButton = actionButton("AUDIO OUTPUT", Color.rgb(35, 43, 69));
        settingsButton.setOnClickListener(v -> openBluetoothSettings());
        row.addView(settingsButton, new LinearLayout.LayoutParams(0, dp(50), 1f));
        return row;
    }

    private View buildPartyPanel() {
        LinearLayout card = panel(PANEL, 20, dp(16));
        LinearLayout stats = new LinearLayout(this);
        stats.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout selectedBox = miniStat("SELECTED", "0 speakers");
        selectedCount = (TextView) selectedBox.getChildAt(1);
        stats.addView(selectedBox, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        LinearLayout routeBox = miniStat("ACTIVE OUTPUT", "Checking…");
        activeRoute = (TextView) routeBox.getChildAt(1);
        LinearLayout.LayoutParams rlp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        rlp.leftMargin = dp(8);
        stats.addView(routeBox, rlp);
        card.addView(stats);
        card.addView(space(14));
        Button start = actionButton("BUILD PARTY PLAN", PURPLE);
        start.setOnClickListener(v -> showPartyPlan());
        card.addView(start, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)));
        card.addView(space(9));
        Button tone = outlineButton("PLAY SYNC TEST TONE");
        tone.setOnClickListener(v -> playSyncTestTone());
        card.addView(tone, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        TextView note = label("The test tone plays through Android’s currently active media route. It confirms which speaker the phone is really sending audio to.", 12, MUTED, false);
        note.setPadding(dp(2), dp(10), dp(2), 0);
        card.addView(note);
        return card;
    }

    private View buildRelayPanel() {
        LinearLayout card = panel(Color.rgb(13, 31, 36), 20, dp(16));
        LinearLayout head = new LinearLayout(this);
        head.setOrientation(LinearLayout.HORIZONTAL);
        head.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = label("RELAY MODE", 14, CYAN, true);
        head.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        head.addView(pill("FOUNDATION", Color.rgb(18, 69, 81), CYAN));
        card.addView(head);
        card.addView(space(8));
        card.addView(label("For the Flip 6 and HT-CT370, a second Android device running SyncLink can become the Bluetooth endpoint while the master phone sends synchronized audio over Wi-Fi.", 14, TEXT, false));
        card.addView(space(10));
        card.addView(label("v0.1: speaker mapping + saved per-speaker delay + route diagnostics are live. Wi-Fi PCM relay comes next.", 12, MUTED, false));
        card.addView(space(12));
        Button explain = outlineButton("HOW RELAY WILL WORK");
        explain.setOnClickListener(v -> showRelayExplanation());
        card.addView(explain, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(46)));
        return card;
    }

    private LinearLayout sectionTitle(String top, String sub) {
        LinearLayout wrap = new LinearLayout(this);
        wrap.setOrientation(LinearLayout.VERTICAL);
        wrap.addView(label(top, 13, Color.rgb(188, 196, 222), true));
        TextView s = label(sub, 12, MUTED, false);
        s.setPadding(0, dp(3), 0, 0);
        wrap.addView(s);
        return wrap;
    }

    private View gearCard(String name, String generation, String detail, int accent) {
        LinearLayout card = panel(PANEL, 17, dp(14));
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        TextView icon = label("♫", 19, accent, true);
        icon.setGravity(Gravity.CENTER);
        icon.setBackground(roundRect(withAlpha(accent, 35), 13));
        row.addView(icon, new LinearLayout.LayoutParams(dp(42), dp(42)));
        LinearLayout text = new LinearLayout(this);
        text.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams tx = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        tx.leftMargin = dp(12);
        row.addView(text, tx);
        text.addView(label(name, 14, TEXT, true));
        text.addView(label(generation, 12, accent, true));
        text.addView(label(detail, 12, MUTED, false));
        card.addView(row);
        return card;
    }

    private LinearLayout miniStat(String title, String value) {
        LinearLayout box = panel(PANEL_2, 14, dp(12));
        box.addView(label(title, 10, MUTED, true));
        TextView v = label(value, 14, TEXT, true);
        v.setPadding(0, dp(4), 0, 0);
        box.addView(v);
        return box;
    }

    private void registerSystemListeners() {
        IntentFilter filter = new IntentFilter();
        filter.addAction(BluetoothDevice.ACTION_FOUND);
        filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_STARTED);
        filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
        filter.addAction(BluetoothDevice.ACTION_BOND_STATE_CHANGED);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(bluetoothReceiver, filter, Context.RECEIVER_EXPORTED);
        else registerReceiver(bluetoothReceiver, filter);
        if (audioManager != null) audioManager.registerAudioDeviceCallback(audioDeviceCallback, null);
        if (bluetoothAdapter != null && hasConnectPermission()) {
            try {
                bluetoothAdapter.getProfileProxy(this, profileListener, BluetoothProfile.A2DP);
                if (Build.VERSION.SDK_INT >= 31) bluetoothAdapter.getProfileProxy(this, profileListener, BluetoothProfile.LE_AUDIO);
            } catch (Exception ignored) {}
        }
    }

    private void requestBluetoothPermissionsIfNeeded() {
        List<String> missing = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 31) {
            if (checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) missing.add(Manifest.permission.BLUETOOTH_SCAN);
            if (checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) missing.add(Manifest.permission.BLUETOOTH_CONNECT);
            if (checkSelfPermission(Manifest.permission.BLUETOOTH_ADVERTISE) != PackageManager.PERMISSION_GRANTED) missing.add(Manifest.permission.BLUETOOTH_ADVERTISE);
        } else if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            missing.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }
        if (!missing.isEmpty()) requestPermissions(missing.toArray(new String[0]), REQ_BT);
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_BT) {
            refreshRoutesAndDevices();
            if (!hasConnectPermission()) toast("Bluetooth permission is needed to read paired speaker names.");
        }
    }

    private boolean hasConnectPermission() {
        return Build.VERSION.SDK_INT < 31 || checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasScanPermission() {
        if (Build.VERSION.SDK_INT >= 31) return checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED;
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void startBluetoothScan() {
        if (bluetoothAdapter == null) { toast("This phone does not expose a Bluetooth adapter."); return; }
        if (!hasScanPermission() || !hasConnectPermission()) { requestBluetoothPermissionsIfNeeded(); return; }
        if (!bluetoothAdapter.isEnabled()) {
            try { startActivity(new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)); }
            catch (Exception e) { openBluetoothSettings(); }
            return;
        }
        try {
            if (bluetoothAdapter.isDiscovering()) bluetoothAdapter.cancelDiscovery();
            boolean started = bluetoothAdapter.startDiscovery();
            if (!started) {
                setScanning(false, "Android did not start discovery. Try Bluetooth settings, then scan again.");
                openBluetoothSettings();
            }
        } catch (SecurityException e) { requestBluetoothPermissionsIfNeeded(); }
    }

    private void setScanning(boolean scanning, String status) {
        if (scanProgress != null) scanProgress.setVisibility(scanning ? View.VISIBLE : View.GONE);
        if (scanButton != null) {
            scanButton.setEnabled(!scanning);
            scanButton.setText(scanning ? "SCANNING…" : "SCAN SPEAKERS");
            scanButton.setAlpha(scanning ? 0.65f : 1f);
        }
        if (scanStatus != null) scanStatus.setText(status);
    }

    private void refreshRoutesAndDevices() {
        updatePhoneCapabilities();
        updateActiveRoute();
        if (bluetoothAdapter == null || !hasConnectPermission()) { renderSpeakers(); return; }
        try {
            Set<BluetoothDevice> bonded = bluetoothAdapter.getBondedDevices();
            for (BluetoothDevice d : bonded) addBluetoothDevice(d, isProfileConnected(d), false);
            if (a2dpProfile != null) for (BluetoothDevice d : a2dpProfile.getConnectedDevices()) addBluetoothDevice(d, true, false);
            if (Build.VERSION.SDK_INT >= 31 && leAudioProfile != null) for (BluetoothDevice d : leAudioProfile.getConnectedDevices()) addBluetoothDevice(d, true, false);
        } catch (SecurityException ignored) {}
        renderSpeakers();
    }

    private boolean isProfileConnected(BluetoothDevice device) {
        try {
            if (a2dpProfile != null && a2dpProfile.getConnectionState(device) == BluetoothProfile.STATE_CONNECTED) return true;
            return Build.VERSION.SDK_INT >= 31 && leAudioProfile != null && leAudioProfile.getConnectionState(device) == BluetoothProfile.STATE_CONNECTED;
        } catch (SecurityException ignored) { return false; }
    }

    private void addBluetoothDevice(BluetoothDevice device, boolean connected, boolean discoveredNow) {
        if (device == null || !hasConnectPermission()) return;
        String address;
        String name;
        try {
            address = device.getAddress();
            name = device.getName();
        } catch (SecurityException e) { return; }
        if (address == null) return;
        if (name == null || name.trim().isEmpty()) name = "Unnamed Bluetooth device";
        SpeakerDevice existing = speakers.get(address);
        if (existing == null) {
            existing = new SpeakerDevice();
            existing.address = address;
            speakers.put(address, existing);
        }
        existing.name = name;
        existing.connected = existing.connected || connected;
        existing.bonded = device.getBondState() == BluetoothDevice.BOND_BONDED;
        existing.discoveredNow = existing.discoveredNow || discoveredNow;
        classify(existing);
        renderSpeakers();
    }

    private void classify(SpeakerDevice d) {
        String n = d.name.toLowerCase(Locale.US);
        d.accent = Color.rgb(111, 123, 153);
        d.capability = "Bluetooth device";
        d.detail = "Capability check required";
        d.auracastLikely = false;
        d.legacyRelay = true;
        if (n.contains("flip 6")) {
            d.accent = CYAN;
            d.capability = "JBL PARTYBOOST";
            d.detail = "Cross-brand party requires Relay mode";
        } else if (n.contains("ht-ct370") || n.contains("ct370")) {
            d.accent = AMBER;
            d.capability = "SONY LEGACY A2DP";
            d.detail = "Direct single output or Relay mode";
        } else if (n.contains("partybox")) {
            d.accent = PURPLE;
            d.capability = "JBL PARTYBOX";
            boolean currentAuracast = n.contains("club 120") || n.contains("stage 320") || n.contains("520") || n.contains("on-the-go 2") || n.contains("on the go 2");
            d.auracastLikely = currentAuracast;
            d.legacyRelay = !currentAuracast;
            d.detail = currentAuracast ? "Current Auracast generation detected" : "Exact model needed to confirm Auracast";
        } else if (n.contains("jbl")) {
            d.accent = Color.rgb(255, 145, 77);
            d.capability = "JBL BLUETOOTH";
            d.detail = "Protocol generation will determine direct vs Relay";
        } else if (n.contains("sony")) {
            d.accent = AMBER;
            d.capability = "SONY BLUETOOTH";
            d.detail = "Checking active audio profile";
        }
    }

    private void renderSpeakers() {
        if (deviceContainer == null) return;
        deviceContainer.removeAllViews();
        selectionBoxes.clear();
        if (speakers.isEmpty()) {
            TextView empty = label("No paired speakers loaded yet. Pair your JBL/Sony devices in Android Bluetooth settings, then come back and scan.", 13, MUTED, false);
            empty.setPadding(dp(12), dp(16), dp(12), dp(12));
            deviceContainer.addView(empty);
            updateSelectedCount();
            return;
        }
        List<SpeakerDevice> list = new ArrayList<>(speakers.values());
        Collections.sort(list, new Comparator<SpeakerDevice>() {
            @Override public int compare(SpeakerDevice a, SpeakerDevice b) {
                if (a.connected != b.connected) return a.connected ? -1 : 1;
                if (a.bonded != b.bonded) return a.bonded ? -1 : 1;
                return a.name.compareToIgnoreCase(b.name);
            }
        });
        for (SpeakerDevice d : list) {
            deviceContainer.addView(space(8));
            deviceContainer.addView(buildSpeakerCard(d));
        }
        updateSelectedCount();
    }

    private View buildSpeakerCard(SpeakerDevice d) {
        LinearLayout card = panel(PANEL, 18, dp(14));
        if (d.connected) card.setBackground(strokeRoundRect(PANEL, GREEN, 1, 18));
        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);
        CheckBox check = new CheckBox(this);
        check.setChecked(prefs.getBoolean("sel_" + d.address, false));
        check.setButtonTintList(android.content.res.ColorStateList.valueOf(d.accent));
        check.setOnCheckedChangeListener((buttonView, isChecked) -> {
            prefs.edit().putBoolean("sel_" + d.address, isChecked).apply();
            updateSelectedCount();
        });
        selectionBoxes.put(d.address, check);
        top.addView(check, new LinearLayout.LayoutParams(dp(44), dp(44)));
        LinearLayout names = new LinearLayout(this);
        names.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams nlp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        nlp.leftMargin = dp(4);
        top.addView(names, nlp);
        names.addView(label(d.name, 15, TEXT, true));
        names.addView(label(d.capability, 11, d.accent, true));
        TextView state = pill(d.connected ? "CONNECTED" : (d.bonded ? "PAIRED" : "NEARBY"), d.connected ? Color.rgb(22, 66, 44) : PANEL_2, d.connected ? GREEN : MUTED);
        top.addView(state);
        card.addView(top);
        TextView detail = label(d.detail, 12, MUTED, false);
        detail.setPadding(dp(48), dp(2), dp(4), 0);
        card.addView(detail);
        LinearLayout latency = new LinearLayout(this);
        latency.setOrientation(LinearLayout.HORIZONTAL);
        latency.setGravity(Gravity.CENTER_VERTICAL);
        latency.setPadding(dp(48), dp(10), 0, 0);
        latency.addView(label("Delay", 11, MUTED, true));
        SeekBar bar = new SeekBar(this);
        bar.setMax(1000);
        int savedMs = prefs.getInt("delay_" + d.address, 0);
        bar.setProgress(savedMs + 500);
        LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(0, dp(36), 1f);
        blp.leftMargin = dp(8);
        latency.addView(bar, blp);
        TextView value = label(formatDelay(savedMs), 11, TEXT, true);
        value.setGravity(Gravity.END);
        latency.addView(value, new LinearLayout.LayoutParams(dp(62), ViewGroup.LayoutParams.WRAP_CONTENT));
        bar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                int ms = progress - 500;
                value.setText(formatDelay(ms));
                if (fromUser) prefs.edit().putInt("delay_" + d.address, ms).apply();
            }
            @Override public void onStartTrackingTouch(SeekBar seekBar) {}
            @Override public void onStopTrackingTouch(SeekBar seekBar) {}
        });
        card.addView(latency);
        card.setOnClickListener(v -> check.setChecked(!check.isChecked()));
        return card;
    }

    private String formatDelay(int ms) { return ms > 0 ? "+" + ms + " ms" : ms + " ms"; }

    private void updateSelectedCount() {
        int count = 0;
        for (CheckBox box : selectionBoxes.values()) if (box.isChecked()) count++;
        if (selectedCount != null) selectedCount.setText(count == 1 ? "1 speaker" : count + " speakers");
    }

    private List<SpeakerDevice> getSelectedSpeakers() {
        List<SpeakerDevice> result = new ArrayList<>();
        for (Map.Entry<String, CheckBox> e : selectionBoxes.entrySet()) {
            if (e.getValue().isChecked()) {
                SpeakerDevice d = speakers.get(e.getKey());
                if (d != null) result.add(d);
            }
        }
        return result;
    }

    private void showPartyPlan() {
        List<SpeakerDevice> selected = getSelectedSpeakers();
        if (selected.isEmpty()) { toast("Select at least one speaker first."); return; }
        int auracast = 0;
        int relay = 0;
        int connected = 0;
        StringBuilder names = new StringBuilder();
        for (SpeakerDevice d : selected) {
            if (d.auracastLikely) auracast++;
            if (d.legacyRelay) relay++;
            if (d.connected) connected++;
            names.append("• ").append(d.name).append(" — ").append(d.capability).append("\n");
        }
        String mode;
        String next;
        if (selected.size() == 1) {
            mode = "DIRECT ROUTE";
            next = "Android can route media to this speaker normally. Connect it in Bluetooth settings, then play music from your usual app.";
        } else if (relay == 0 && auracast == selected.size()) {
            mode = "AURACAST CANDIDATE";
            next = "All selected speakers look like current Auracast-generation devices. Samsung’s system Audio Broadcast UI still owns the actual broadcast session, so SyncLink hands off to system Bluetooth controls.";
        } else {
            mode = "HYBRID PARTY";
            next = relay + " selected speaker" + (relay == 1 ? " needs" : "s need") + " Relay mode for true cross-brand sync. One compatible direct/Auracast route can act as the master while relay phones/pods handle legacy speakers.";
        }
        String body = "Mode: " + mode + "\n\n" + names + "\nCurrently connected: " + connected + "/" + selected.size() + "\nAuracast-likely: " + auracast + "\nRelay-needed: " + relay + "\n\n" + next;
        new AlertDialog.Builder(this)
                .setTitle("SyncLink party plan")
                .setMessage(body)
                .setNegativeButton("Close", null)
                .setPositiveButton("Open Bluetooth", (d, which) -> openBluetoothSettings())
                .show();
    }

    private void showRelayExplanation() {
        String body = "MASTER PHONE\nMusic → timestamped Wi-Fi frames\n\n" +
                "RELAY PHONE A → Bluetooth → JBL Flip 6\n" +
                "RELAY PHONE B → Bluetooth → Sony HT-CT370\n" +
                "DIRECT/AURACAST → supported PartyBox\n\n" +
                "Each speaker keeps a saved delay offset so slower Bluetooth hardware can be aligned with faster speakers. v0.1 stores those offsets and maps real Android routes. The next engine layer is timestamped PCM/Opus streaming between SyncLink devices.";
        new AlertDialog.Builder(this).setTitle("Relay mode architecture").setMessage(body).setPositiveButton("Got it", null).show();
    }

    private void playSyncTestTone() {
        try {
            ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_MUSIC, 82);
            tg.startTone(ToneGenerator.TONE_PROP_BEEP2, 850);
            new android.os.Handler(getMainLooper()).postDelayed(tg::release, 1200);
            toast("Test tone sent to the current Android media output.");
        } catch (Exception e) { toast("Could not start the test tone on this route."); }
    }

    private void updatePhoneCapabilities() {
        if (capabilityLine == null) return;
        if (bluetoothAdapter == null) { capabilityLine.setText("Bluetooth unavailable on this device"); return; }
        boolean le = getPackageManager().hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE);
        boolean ext = false;
        boolean periodic = false;
        boolean phy2m = false;
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                ext = bluetoothAdapter.isLeExtendedAdvertisingSupported();
                periodic = bluetoothAdapter.isLePeriodicAdvertisingSupported();
                phy2m = bluetoothAdapter.isLe2MPhySupported();
            }
        } catch (Exception ignored) {}
        String leAudioApi = Build.VERSION.SDK_INT >= 31 ? "LE Audio API" : "classic audio API";
        capabilityLine.setText("PHONE • " + leAudioApi + " • BLE " + yesNo(le) + " • 2M " + yesNo(phy2m) + " • ExtAdv " + yesNo(ext) + " • PeriodicAdv " + yesNo(periodic));
    }

    private String yesNo(boolean value) { return value ? "✓" : "—"; }

    private void updateActiveRoute() {
        if (activeRoute == null || audioManager == null) return;
        AudioDeviceInfo[] outputs = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS);
        List<String> priority = new ArrayList<>();
        for (AudioDeviceInfo d : outputs) {
            int type = d.getType();
            if (type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || type == AudioDeviceInfo.TYPE_BLE_SPEAKER || type == AudioDeviceInfo.TYPE_BLE_HEADSET || type == AudioDeviceInfo.TYPE_USB_DEVICE || type == AudioDeviceInfo.TYPE_USB_HEADSET || type == AudioDeviceInfo.TYPE_HDMI) {
                String product = d.getProductName() == null ? audioTypeName(type) : d.getProductName().toString();
                priority.add(product);
            }
        }
        activeRoute.setText(priority.isEmpty() ? "Phone speaker" : priority.get(0));
    }

    private String audioTypeName(int type) {
        if (type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP) return "Bluetooth A2DP";
        if (type == AudioDeviceInfo.TYPE_BLE_SPEAKER) return "BLE speaker";
        if (type == AudioDeviceInfo.TYPE_BLE_HEADSET) return "LE Audio headset";
        if (type == AudioDeviceInfo.TYPE_HDMI) return "HDMI";
        if (type == AudioDeviceInfo.TYPE_USB_DEVICE || type == AudioDeviceInfo.TYPE_USB_HEADSET) return "USB audio";
        return "Audio output";
    }

    private void openBluetoothSettings() {
        try { startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS)); }
        catch (Exception e) { startActivity(new Intent(Settings.ACTION_SETTINGS)); }
    }

    private Button actionButton(String text, int bg) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextColor(Color.WHITE);
        b.setTextSize(12);
        b.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        b.setAllCaps(false);
        b.setGravity(Gravity.CENTER);
        b.setPadding(dp(10), 0, dp(10), 0);
        b.setBackground(roundRect(bg, 15));
        b.setStateListAnimator(null);
        return b;
    }

    private Button outlineButton(String text) {
        Button b = actionButton(text, Color.TRANSPARENT);
        b.setBackground(strokeRoundRect(Color.TRANSPARENT, Color.rgb(65, 77, 112), 1, 15));
        b.setTextColor(Color.rgb(213, 219, 239));
        return b;
    }

    private TextView label(String text, int sp, int color, boolean bold) {
        TextView v = new TextView(this);
        v.setText(text);
        v.setTextColor(color);
        v.setTextSize(sp);
        v.setLineSpacing(0f, 1.12f);
        if (bold) v.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return v;
    }

    private TextView pill(String text, int bg, int fg) {
        TextView v = label(text, 10, fg, true);
        v.setGravity(Gravity.CENTER);
        v.setPadding(dp(9), dp(5), dp(9), dp(5));
        v.setBackground(roundRect(bg, 100));
        return v;
    }

    private LinearLayout panel(int color, int radius, int padding) {
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        l.setPadding(padding, padding, padding, padding);
        l.setBackground(roundRect(color, radius));
        return l;
    }

    private GradientDrawable gradientPanel() {
        GradientDrawable d = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{Color.rgb(24, 25, 52), Color.rgb(11, 31, 43)});
        d.setCornerRadius(dp(22));
        d.setStroke(dp(1), Color.rgb(57, 64, 99));
        return d;
    }

    private GradientDrawable roundRect(int color, int radiusDp) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(dp(radiusDp));
        return d;
    }

    private GradientDrawable strokeRoundRect(int fill, int stroke, int strokeDp, int radiusDp) {
        GradientDrawable d = roundRect(fill, radiusDp);
        d.setStroke(dp(strokeDp), stroke);
        return d;
    }

    private int withAlpha(int color, int alpha) { return Color.argb(alpha, Color.red(color), Color.green(color), Color.blue(color)); }

    private View space(int amount) {
        Space s = new Space(this);
        s.setLayoutParams(new LinearLayout.LayoutParams(1, dp(amount)));
        return s;
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private void toast(String text) { Toast.makeText(this, text, Toast.LENGTH_SHORT).show(); }

    private static class SpeakerDevice {
        String address;
        String name;
        String capability;
        String detail;
        boolean connected;
        boolean bonded;
        boolean discoveredNow;
        boolean auracastLikely;
        boolean legacyRelay;
        int accent;
    }
}
