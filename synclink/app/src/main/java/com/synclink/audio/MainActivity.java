package com.synclink.audio;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.BluetoothA2dp;
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
import android.widget.ProgressBar;
import android.widget.ScrollView;
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
    private static final int PANEL_2 = Color.rgb(23, 29, 51);
    private static final int TEXT = Color.rgb(244, 246, 255);
    private static final int MUTED = Color.rgb(157, 167, 194);
    private static final int PURPLE = Color.rgb(124, 92, 255);
    private static final int CYAN = Color.rgb(65, 210, 245);
    private static final int GREEN = Color.rgb(74, 222, 128);
    private static final int AMBER = Color.rgb(251, 191, 36);
    private static final int ORANGE = Color.rgb(255, 145, 77);

    private BluetoothAdapter bluetoothAdapter;
    private AudioManager audioManager;
    private SharedPreferences prefs;
    private LinearLayout deviceContainer;
    private TextView scanStatus;
    private TextView selectedCount;
    private TextView routeStatus;
    private TextView sessionStatus;
    private Button scanButton;
    private Button startPartyButton;
    private ProgressBar scanProgress;

    private final LinkedHashMap<String, SpeakerDevice> speakers = new LinkedHashMap<>();
    private final LinkedHashMap<String, CheckBox> selectionBoxes = new LinkedHashMap<>();
    private final List<String> liveOutputNames = new ArrayList<>();
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
                setScanning(true, "Looking for nearby speakers…");
            } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(action)) {
                setScanning(false, speakers.isEmpty() ? "No speakers found. Put one in pairing mode and scan again." : "Scan complete");
            } else {
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
        if (!prefs.getBoolean("tutorial_seen_v2", false)) {
            new Handler(getMainLooper()).postDelayed(() -> showTutorialStep(0), 500);
        }
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
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BG);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(18), dp(20), dp(18), dp(40));
        scroll.addView(content, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        content.addView(buildHeader());
        content.addView(space(16));
        content.addView(buildStatusCard());
        content.addView(space(24));

        content.addView(stepTitle("1", "Choose your speakers", "Tap a card to add or remove it from this party."));
        content.addView(space(10));
        content.addView(buildScanBar());
        content.addView(space(10));
        deviceContainer = new LinearLayout(this);
        deviceContainer.setOrientation(LinearLayout.VERTICAL);
        content.addView(deviceContainer);

        content.addView(space(26));
        content.addView(stepTitle("2", "Start the party", "SyncLink prepares your group, then opens Android’s compact output picker when the phone needs to choose the real audio route."));
        content.addView(space(10));
        content.addView(buildPartyCard());

        content.addView(space(26));
        content.addView(stepTitle("3", "Play your music", "Once your outputs are set, jump straight into Pandora. Your SyncLink group stays saved when you leave the app."));
        content.addView(space(10));
        content.addView(buildMusicCard());

        content.addView(space(22));
        TextView foot = label("SyncLink v0.2 • speaker selections are saved automatically", 12, Color.rgb(103, 114, 145), false);
        foot.setGravity(Gravity.CENTER);
        content.addView(foot);
        return scroll;
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
        Button help = smallButton("?", PANEL_2);
        help.setOnClickListener(v -> showTutorialStep(0));
        row.addView(help, new LinearLayout.LayoutParams(dp(44), dp(44)));
        return row;
    }

    private View buildStatusCard() {
        LinearLayout card = panel(Color.rgb(13, 25, 45), 20, dp(16));
        LinearLayout line = new LinearLayout(this);
        line.setOrientation(LinearLayout.HORIZONTAL);
        line.setGravity(Gravity.CENTER_VERTICAL);
        line.addView(label("●", 13, GREEN, true));
        routeStatus = label("  Checking your audio setup…", 13, GREEN, true);
        line.addView(routeStatus, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        card.addView(line);
        card.addView(space(8));
        sessionStatus = label("Pick the speakers you want, then press Start Party.", 14, TEXT, false);
        card.addView(sessionStatus);
        return card;
    }

    private View stepTitle(String number, String title, String subtitle) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.TOP);
        TextView n = label(number, 13, Color.WHITE, true);
        n.setGravity(Gravity.CENTER);
        n.setBackground(roundRect(PURPLE, 100));
        row.addView(n, new LinearLayout.LayoutParams(dp(30), dp(30)));
        LinearLayout t = new LinearLayout(this);
        t.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        lp.leftMargin = dp(10);
        row.addView(t, lp);
        t.addView(label(title, 19, TEXT, true));
        TextView sub = label(subtitle, 13, MUTED, false);
        sub.setPadding(0, dp(4), 0, 0);
        t.addView(sub);
        return row;
    }

    private View buildScanBar() {
        LinearLayout card = panel(PANEL, 16, dp(12));
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        scanProgress = new ProgressBar(this);
        scanProgress.setIndeterminate(true);
        scanProgress.setVisibility(View.GONE);
        row.addView(scanProgress, new LinearLayout.LayoutParams(dp(22), dp(22)));
        scanStatus = label("Paired speakers appear automatically", 12, MUTED, false);
        LinearLayout.LayoutParams slp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        slp.leftMargin = dp(8);
        row.addView(scanStatus, slp);
        scanButton = smallButton("Scan", PURPLE);
        scanButton.setOnClickListener(v -> startBluetoothScan());
        row.addView(scanButton, new LinearLayout.LayoutParams(dp(86), dp(42)));
        card.addView(row);
        return card;
    }

    private View buildPartyCard() {
        LinearLayout card = panel(PANEL, 18, dp(16));
        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);
        selectedCount = label("0 selected", 14, TEXT, true);
        top.addView(selectedCount, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView saved = pill("AUTO-SAVED", Color.rgb(22, 56, 48), GREEN);
        top.addView(saved);
        card.addView(top);
        card.addView(space(12));
        startPartyButton = actionButton("START PARTY", PURPLE);
        startPartyButton.setOnClickListener(v -> startParty());
        card.addView(startPartyButton, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)));
        card.addView(space(9));
        Button outputs = outlineButton("CHOOSE AUDIO OUTPUTS");
        outputs.setOnClickListener(v -> showOutputSwitcher());
        card.addView(outputs, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(46)));
        TextView note = label("You should only see the compact Android output panel here—not the full Bluetooth settings screen.", 12, MUTED, false);
        note.setPadding(0, dp(10), 0, 0);
        card.addView(note);
        return card;
    }

    private View buildMusicCard() {
        LinearLayout card = panel(Color.rgb(24, 19, 40), 18, dp(16));
        LinearLayout head = new LinearLayout(this);
        head.setOrientation(LinearLayout.HORIZONTAL);
        head.setGravity(Gravity.CENTER_VERTICAL);
        TextView icon = label("P", 20, Color.WHITE, true);
        icon.setGravity(Gravity.CENTER);
        icon.setBackground(roundRect(Color.rgb(36, 120, 255), 12));
        head.addView(icon, new LinearLayout.LayoutParams(dp(42), dp(42)));
        LinearLayout txt = new LinearLayout(this);
        txt.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams tlp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        tlp.leftMargin = dp(12);
        head.addView(txt, tlp);
        txt.addView(label("Pandora", 16, TEXT, true));
        txt.addView(label("Use your normal Pandora account and library", 12, MUTED, false));
        card.addView(head);
        card.addView(space(14));
        Button pandora = actionButton("OPEN PANDORA", Color.rgb(36, 120, 255));
        pandora.setOnClickListener(v -> openPandora());
        card.addView(pandora, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(50)));
        card.addView(space(8));
        TextView note = label("Pandora keeps playing through Android’s selected output(s) after you leave SyncLink. SyncLink remembers your chosen speaker group when you come back.", 12, MUTED, false);
        card.addView(note);
        return card;
    }

    private void showTutorialStep(int step) {
        String[] titles = {"Pick your speakers", "Start the party", "Play music"};
        String[] messages = {
                "Tap the speaker cards you want. A check means “use this speaker in my SyncLink party.” Tapping a paired speaker never sends you to Bluetooth settings.",
                "Press Start Party. SyncLink saves the group and opens Android’s small output picker only when the phone itself must choose the real Bluetooth outputs.",
                "Open Pandora from SyncLink and play normally. You can leave SyncLink; Android keeps the Bluetooth audio route and SyncLink remembers the group for next time."
        };
        AlertDialog.Builder b = new AlertDialog.Builder(this)
                .setTitle((step + 1) + " of 3 • " + titles[step])
                .setMessage(messages[step])
                .setNegativeButton(step == 0 ? "Skip" : "Back", (d, w) -> {
                    if (step == 0) prefs.edit().putBoolean("tutorial_seen_v2", true).apply();
                    else showTutorialStep(step - 1);
                });
        if (step < 2) b.setPositiveButton("Next", (d, w) -> showTutorialStep(step + 1));
        else b.setPositiveButton("Done", (d, w) -> prefs.edit().putBoolean("tutorial_seen_v2", true).apply());
        b.show();
    }

    private void registerSystemListeners() {
        IntentFilter filter = new IntentFilter();
        filter.addAction(BluetoothDevice.ACTION_FOUND);
        filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_STARTED);
        filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
        filter.addAction(BluetoothDevice.ACTION_BOND_STATE_CHANGED);
        filter.addAction(BluetoothDevice.ACTION_ACL_CONNECTED);
        filter.addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED);
        filter.addAction(BluetoothA2dp.ACTION_CONNECTION_STATE_CHANGED);
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
        } else if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            missing.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }
        if (!missing.isEmpty()) requestPermissions(missing.toArray(new String[0]), REQ_BT);
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_BT) refreshRoutesAndDevices();
    }

    private boolean hasConnectPermission() {
        return Build.VERSION.SDK_INT < 31 || checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasScanPermission() {
        if (Build.VERSION.SDK_INT >= 31) return checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED;
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void startBluetoothScan() {
        if (bluetoothAdapter == null) { toast("Bluetooth is not available on this phone."); return; }
        if (!hasScanPermission() || !hasConnectPermission()) { requestBluetoothPermissionsIfNeeded(); return; }
        if (!bluetoothAdapter.isEnabled()) {
            try { startActivity(new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)); }
            catch (Exception ignored) { toast("Turn Bluetooth on, then try again."); }
            return;
        }
        try {
            if (bluetoothAdapter.isDiscovering()) bluetoothAdapter.cancelDiscovery();
            if (!bluetoothAdapter.startDiscovery()) setScanning(false, "Android could not start a scan. Try again in a moment.");
        } catch (SecurityException e) { requestBluetoothPermissionsIfNeeded(); }
    }

    private void setScanning(boolean scanning, String status) {
        if (scanProgress != null) scanProgress.setVisibility(scanning ? View.VISIBLE : View.GONE);
        if (scanButton != null) {
            scanButton.setEnabled(!scanning);
            scanButton.setText(scanning ? "…" : "Scan");
        }
        if (scanStatus != null) scanStatus.setText(status);
    }

    private void refreshRoutesAndDevices() {
        refreshLiveOutputs();
        if (bluetoothAdapter != null && hasConnectPermission()) {
            try {
                Set<BluetoothDevice> bonded = bluetoothAdapter.getBondedDevices();
                for (BluetoothDevice d : bonded) addBluetoothDevice(d, isProfileConnected(d) || matchesLiveOutput(safeName(d)), false);
                if (a2dpProfile != null) for (BluetoothDevice d : a2dpProfile.getConnectedDevices()) addBluetoothDevice(d, true, false);
                if (Build.VERSION.SDK_INT >= 31 && leAudioProfile != null) for (BluetoothDevice d : leAudioProfile.getConnectedDevices()) addBluetoothDevice(d, true, false);
            } catch (SecurityException ignored) {}
        }
        renderSpeakers();
        updateStatusCard();
    }

    private void refreshLiveOutputs() {
        liveOutputNames.clear();
        if (audioManager == null) return;
        AudioDeviceInfo[] outputs = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS);
        for (AudioDeviceInfo d : outputs) {
            int t = d.getType();
            if (t == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || t == AudioDeviceInfo.TYPE_BLE_SPEAKER || t == AudioDeviceInfo.TYPE_BLE_HEADSET) {
                CharSequence p = d.getProductName();
                if (p != null) liveOutputNames.add(p.toString());
            }
        }
    }

    private String safeName(BluetoothDevice d) {
        try { return d.getName() == null ? "" : d.getName(); }
        catch (SecurityException e) { return ""; }
    }

    private boolean matchesLiveOutput(String name) {
        String a = normalize(name);
        if (a.isEmpty()) return false;
        for (String route : liveOutputNames) {
            String b = normalize(route);
            if (a.equals(b) || a.contains(b) || b.contains(a)) return true;
        }
        return false;
    }

    private String normalize(String s) {
        return s == null ? "" : s.toLowerCase(Locale.US).replaceAll("[^a-z0-9]", "");
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
        SpeakerDevice d = speakers.get(address);
        if (d == null) {
            d = new SpeakerDevice();
            d.address = address;
            speakers.put(address, d);
        }
        d.device = device;
        d.name = name;
        d.connected = connected || matchesLiveOutput(name);
        d.bonded = device.getBondState() == BluetoothDevice.BOND_BONDED;
        d.discoveredNow = discoveredNow;
        classify(d);
        renderSpeakers();
    }

    private void classify(SpeakerDevice d) {
        String n = d.name.toLowerCase(Locale.US);
        d.accent = Color.rgb(115, 126, 154);
        d.kind = "Bluetooth speaker";
        d.note = d.bonded ? "Ready to use" : "Tap Pair to add this speaker";
        d.needsRelay = true;
        d.auracast = false;
        if (n.contains("partybox club 120") || n.contains("club 120")) {
            d.accent = PURPLE;
            d.kind = "JBL PartyBox Club 120";
            d.note = "Auracast-capable + normal Bluetooth audio";
            d.needsRelay = false;
            d.auracast = true;
        } else if (n.contains("flip6") || n.contains("flip 6")) {
            d.accent = ORANGE;
            d.kind = "JBL Flip 6";
            d.note = "PartyBoost generation";
            d.needsRelay = true;
        } else if (n.contains("charge 5")) {
            d.accent = ORANGE;
            d.kind = "JBL Charge 5";
            d.note = "PartyBoost generation";
            d.needsRelay = true;
        } else if (n.contains("ht-ct370") || n.contains("ct370")) {
            d.accent = AMBER;
            d.kind = "Sony HT-CT370";
            d.note = "Classic Bluetooth soundbar";
            d.needsRelay = true;
        } else if (n.contains("jbl")) {
            d.accent = ORANGE;
            d.kind = "JBL Bluetooth";
            d.note = "Generation will determine group support";
        } else if (n.contains("sony")) {
            d.accent = AMBER;
            d.kind = "Sony Bluetooth";
        }
    }

    private void renderSpeakers() {
        if (deviceContainer == null) return;
        deviceContainer.removeAllViews();
        selectionBoxes.clear();
        if (speakers.isEmpty()) {
            TextView empty = label("No speakers yet. Pair your speakers once, or put a new speaker in pairing mode and tap Scan.", 13, MUTED, false);
            empty.setPadding(dp(12), dp(14), dp(12), dp(14));
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
            deviceContainer.addView(buildSpeakerCard(d));
            deviceContainer.addView(space(8));
        }
        updateSelectedCount();
    }

    private View buildSpeakerCard(SpeakerDevice d) {
        LinearLayout card = panel(PANEL, 17, dp(13));
        boolean selected = prefs.getBoolean("sel_" + d.address, false);
        card.setBackground(strokeRoundRect(PANEL, selected ? d.accent : Color.rgb(34, 42, 66), selected ? 2 : 1, 17));
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        CheckBox check = new CheckBox(this);
        check.setChecked(selected);
        check.setButtonTintList(android.content.res.ColorStateList.valueOf(d.accent));
        selectionBoxes.put(d.address, check);
        row.addView(check, new LinearLayout.LayoutParams(dp(44), dp(44)));
        LinearLayout txt = new LinearLayout(this);
        txt.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams tlp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        tlp.leftMargin = dp(4);
        row.addView(txt, tlp);
        txt.addView(label(d.name, 15, TEXT, true));
        txt.addView(label(d.kind, 12, d.accent, true));
        TextView state = pill(d.connected ? "CONNECTED" : (d.bonded ? "PAIRED" : "NEARBY"), d.connected ? Color.rgb(20, 63, 44) : PANEL_2, d.connected ? GREEN : MUTED);
        row.addView(state);
        card.addView(row);
        TextView note = label(d.note, 12, MUTED, false);
        note.setPadding(dp(48), dp(2), 0, 0);
        card.addView(note);
        if (!d.bonded) {
            Button pair = outlineButton("PAIR IN SYNCLINK");
            pair.setOnClickListener(v -> pairDevice(d));
            LinearLayout.LayoutParams plp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(44));
            plp.topMargin = dp(10);
            card.addView(pair, plp);
        }
        check.setOnCheckedChangeListener((buttonView, isChecked) -> {
            prefs.edit().putBoolean("sel_" + d.address, isChecked).apply();
            renderSpeakers();
            updateStatusCard();
        });
        card.setOnClickListener(v -> check.setChecked(!check.isChecked()));
        return card;
    }

    private void pairDevice(SpeakerDevice d) {
        if (d.device == null || !hasConnectPermission()) { requestBluetoothPermissionsIfNeeded(); return; }
        try {
            if (d.device.createBond()) toast("Pairing started. Confirm the Android pairing prompt if one appears.");
            else toast("Android could not start pairing with this device.");
        } catch (SecurityException e) { requestBluetoothPermissionsIfNeeded(); }
    }

    private void updateSelectedCount() {
        int count = 0;
        for (Map.Entry<String, SpeakerDevice> e : speakers.entrySet()) if (prefs.getBoolean("sel_" + e.getKey(), false)) count++;
        if (selectedCount != null) selectedCount.setText(count == 1 ? "1 speaker selected" : count + " speakers selected");
        if (startPartyButton != null) {
            startPartyButton.setEnabled(count > 0);
            startPartyButton.setAlpha(count > 0 ? 1f : 0.45f);
        }
    }

    private List<SpeakerDevice> getSelectedSpeakers() {
        List<SpeakerDevice> out = new ArrayList<>();
        for (Map.Entry<String, SpeakerDevice> e : speakers.entrySet()) if (prefs.getBoolean("sel_" + e.getKey(), false)) out.add(e.getValue());
        return out;
    }

    private void startParty() {
        List<SpeakerDevice> selected = getSelectedSpeakers();
        if (selected.isEmpty()) { toast("Choose at least one speaker first."); return; }
        prefs.edit().putBoolean("session_active", true).apply();
        updateStatusCard();
        int legacy = 0;
        for (SpeakerDevice d : selected) if (d.needsRelay) legacy++;
        if (selected.size() > 2 || legacy > 1) {
            new AlertDialog.Builder(this)
                    .setTitle("Party saved")
                    .setMessage("Your speaker group is saved. Android can handle the currently supported outputs in its compact picker. Speakers beyond the phone’s native multi-output limit will need SyncLink Relay in a later build.")
                    .setNegativeButton("Not now", null)
                    .setPositiveButton("Choose outputs", (dialog, which) -> showOutputSwitcher())
                    .show();
        } else {
            showOutputSwitcher();
        }
    }

    private void showOutputSwitcher() {
        if (Build.VERSION.SDK_INT >= 30) {
            try {
                boolean shown = MediaRouter2.getInstance(this).showSystemOutputSwitcher();
                if (shown) return;
            } catch (Exception ignored) {}
        }
        new AlertDialog.Builder(this)
                .setTitle("Android output picker unavailable")
                .setMessage("This phone did not expose the compact media-output panel to SyncLink. You can open Bluetooth settings as a fallback, but SyncLink will never do that without asking first.")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Open Bluetooth", (d, w) -> openBluetoothSettings())
                .show();
    }

    private void updateStatusCard() {
        if (routeStatus == null || sessionStatus == null) return;
        if (!liveOutputNames.isEmpty()) {
            routeStatus.setText("  Audio connected • " + String.join(" + ", liveOutputNames));
        } else {
            routeStatus.setText("  Bluetooth ready • no active speaker output detected");
        }
        boolean active = prefs.getBoolean("session_active", false);
        int selected = getSelectedSpeakers().size();
        if (active && selected > 0) {
            sessionStatus.setText("Party setup saved with " + selected + (selected == 1 ? " speaker. " : " speakers. ") + "You can leave SyncLink—your Bluetooth route stays with Android and this group will still be here when you return.");
        } else {
            sessionStatus.setText("Choose the speakers you want, then press Start Party.");
        }
        updateSelectedCount();
    }

    private void openPandora() {
        try {
            Intent launch = getPackageManager().getLaunchIntentForPackage("com.pandora.android");
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(launch);
                return;
            }
            Intent market = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.pandora.android"));
            startActivity(market);
        } catch (Exception e) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=com.pandora.android"))); }
            catch (Exception ignored) { toast("Pandora could not be opened on this phone."); }
        }
    }

    private void openBluetoothSettings() {
        try { startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS)); }
        catch (Exception e) { toast("Bluetooth settings are unavailable."); }
    }

    private Button actionButton(String text, int bg) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextColor(Color.WHITE);
        b.setTextSize(13);
        b.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        b.setAllCaps(false);
        b.setGravity(Gravity.CENTER);
        b.setPadding(dp(12), 0, dp(12), 0);
        b.setBackground(roundRect(bg, 15));
        b.setStateListAnimator(null);
        return b;
    }

    private Button smallButton(String text, int bg) {
        Button b = actionButton(text, bg);
        b.setTextSize(12);
        b.setPadding(dp(8), 0, dp(8), 0);
        return b;
    }

    private Button outlineButton(String text) {
        Button b = actionButton(text, Color.TRANSPARENT);
        b.setTextColor(Color.rgb(215, 221, 241));
        b.setBackground(strokeRoundRect(Color.TRANSPARENT, Color.rgb(66, 77, 111), 1, 14));
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

    private View space(int amount) {
        Space s = new Space(this);
        s.setLayoutParams(new LinearLayout.LayoutParams(1, dp(amount)));
        return s;
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private void toast(String text) { Toast.makeText(this, text, Toast.LENGTH_SHORT).show(); }

    private static class SpeakerDevice {
        BluetoothDevice device;
        String address;
        String name;
        String kind;
        String note;
        boolean connected;
        boolean bonded;
        boolean discoveredNow;
        boolean auracast;
        boolean needsRelay;
        int accent;
    }
}
