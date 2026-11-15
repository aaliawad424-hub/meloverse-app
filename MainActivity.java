package app.meloverse;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/**
 * MeloVerse — Android shell.
 * The whole product is the web app; this WebView container only adds:
 *  - first-run server setup (works with any Railway/VPS URL, http or https)
 *  - hardware back navigation, downloads, error recovery
 * Keeping it this thin is what makes the APK stable for years: no AndroidX,
 * no third-party SDKs that break on new OS versions.
 */
public class MainActivity extends Activity {

    private static final String PREFS = "meloverse";
    private static final String KEY_SERVER = "server";
    private static final int BG = 0xFF0D0E14;
    private static final int CARD = 0xFF171A26;
    private static final int BRAND = 0xFF7C5CFF;
    private static final int TEXT = 0xFFEEF0F7;
    private static final int MUTED = 0xFF98A0B8;

    private FrameLayout root;
    private WebView web;
    private ProgressBar bar;
    private SharedPreferences prefs;
    private String server;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        server = prefs.getString(KEY_SERVER, "");
        Window w = getWindow();
        w.setStatusBarColor(BG);
        w.setNavigationBarColor(BG);
        if (Build.VERSION.SDK_INT >= 21) {
            w.setFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS, WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        }
        root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        setContentView(root);
        if (server == null || server.trim().isEmpty()) {
            showSetup();
        } else {
            showApp(server);
        }
    }

    /* ---------------------------- setup screen ---------------------------- */
    private void showSetup() {
        root.removeAllViews();
        if (web != null) { root.removeView(web); web.destroy(); web = null; }

        ScrollView scroll = new ScrollView(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(26), dp(46), dp(26), dp(30));
        box.setBackgroundColor(BG);

        TextView logo = new TextView(this);
        logo.setText("MeloVerse");
        logo.setTextSize(34);
        logo.setTextColor(TEXT);
        logo.setGravity(Gravity.CENTER);
        logo.setTypeface(logo.getTypeface(), android.graphics.Typeface.BOLD);
        box.addView(logo);

        TextView sub = new TextView(this);
        sub.setText("عالم المانجا والمانهوا في مكان واحد");
        sub.setTextSize(14);
        sub.setTextColor(MUTED);
        sub.setGravity(Gravity.CENTER);
        sub.setPadding(0, dp(6), 0, dp(28));
        box.addView(sub);

        TextView label = new TextView(this);
        label.setText("رابط السيرفر");
        label.setTextSize(13);
        label.setTextColor(MUTED);
        label.setPadding(0, 0, 0, dp(8));
        box.addView(label);

        final EditText input = new EditText(this);
        input.setHint("https://meloverse.up.railway.app");
        input.setTextColor(TEXT);
        input.setHintTextColor(0xFF5A6178);
        input.setTextSize(15);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
        input.setBackgroundColor(CARD);
        input.setPadding(dp(14), dp(14), dp(14), dp(14));
        box.addView(input, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView hint = new TextView(this);
        hint.setText("الصق رابط التطبيق الذي حصلت عليه بعد النشر على Railway أو أي استضافة، ثم اضغط متابعة.");
        hint.setTextSize(12);
        hint.setTextColor(MUTED);
        hint.setPadding(0, dp(10), 0, dp(22));
        box.addView(hint);

        Button go = new Button(this);
        go.setText("متابعة");
        go.setTextSize(16);
        go.setTextColor(Color.WHITE);
        go.setBackgroundColor(BRAND);
        go.setPadding(0, dp(12), 0, dp(12));
        box.addView(go, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView foot = new TextView(this);
        foot.setText("الإصدار 1.0.0 · يمكنك تغيير الرابط لاحقاً من زر الرجوع في الصفحة الرئيسية");
        foot.setTextSize(11);
        foot.setTextColor(0xFF5A6178);
        foot.setGravity(Gravity.CENTER);
        foot.setPadding(0, dp(22), 0, 0);
        box.addView(foot);

        scroll.addView(box);
        root.addView(scroll);

        go.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                String url = normalize(input.getText().toString());
                if (url == null) {
                    Toast.makeText(MainActivity.this, "أدخل رابطاً صحيحاً يبدأ بـ http أو https", Toast.LENGTH_LONG).show();
                    return;
                }
                prefs.edit().putString(KEY_SERVER, url).apply();
                server = url;
                showApp(url);
            }
        });
    }

    private String normalize(String raw) {
        if (raw == null) return null;
        String u = raw.trim();
        if (u.isEmpty()) return null;
        if (!u.startsWith("http://") && !u.startsWith("https://")) u = "https://" + u;
        while (u.endsWith("/")) u = u.substring(0, u.length() - 1);
        if (u.length() < 12 || !u.contains(".")) return null;
        return u;
    }

    /* ------------------------------ app screen ------------------------------ */
    private void showApp(String base) {
        root.removeAllViews();
        web = new WebView(this);
        web.setBackgroundColor(BG);
        web.setLayoutParams(new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(false);
        s.setBuiltInZoomControls(false);
        s.setSupportZoom(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= 21) s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        String ua = s.getUserAgentString();
        if (ua != null && !ua.contains("MeloVerseApp")) s.setUserAgentString(ua + " MeloVerseApp/1.0");
        CookieManager.getInstance().setAcceptCookie(true);

        bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(100);
        FrameLayout.LayoutParams blp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3));
        blp.gravity = Gravity.TOP;
        bar.setLayoutParams(blp);
        bar.setProgressTintList(android.content.res.ColorStateList.valueOf(BRAND));

        web.setWebChromeClient(new WebChromeClient() {
            public void onProgressChanged(WebView v, int p) {
                if (bar == null) return;
                bar.setVisibility(p >= 100 ? View.GONE : View.VISIBLE);
                bar.setProgress(p);
            }
        });

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, android.webkit.WebResourceRequest req) {
                return handleUrl(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                return handleUrl(Uri.parse(url));
            }

            private boolean handleUrl(Uri uri) {
                if (uri == null) return false;
                String scheme = uri.getScheme() == null ? "" : uri.getScheme();
                if (scheme.startsWith("http")) {
                    String host = uri.getHost() == null ? "" : uri.getHost();
                    String baseHost = Uri.parse(server).getHost();
                    if (baseHost != null && host.endsWith(baseHost)) return false;
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) { }
                    return true;
                }
                if (scheme.startsWith("mailto") || scheme.startsWith("tel") || scheme.startsWith("whatsapp")) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { }
                    return true;
                }
                return false;
            }

            @Override
            public void onReceivedError(WebView v, int code, String desc, String failingUrl) {
                if (failingUrl != null && failingUrl.equals(v.getUrl())) showError();
            }

            @Override
            public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail detail) {
                if (Build.VERSION.SDK_INT >= 26) {
                    Toast.makeText(MainActivity.this, "جارٍ إعادة تشغيل الواجهة…", Toast.LENGTH_SHORT).show();
                    showApp(server);
                    return true;
                }
                return false;
            }
        });

        web.setDownloadListener(new DownloadListener() {
            public void onDownloadStart(String url, String userAgent, String disposition, String mime, long len) {
                try {
                    DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                    String name = android.webkit.URLUtil.guessFileName(url, disposition, mime);
                    req.setTitle(name);
                    req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                    DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    if (dm != null) dm.enqueue(req);
                    Toast.makeText(MainActivity.this, "بدأ التحميل", Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "تعذّر التحميل", Toast.LENGTH_SHORT).show();
                }
            }
        });

        root.addView(web);
        root.addView(bar);
        web.loadUrl(base + "/");
    }

    private void showError() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setPadding(dp(28), dp(28), dp(28), dp(28));
        box.setBackgroundColor(BG);

        TextView t = new TextView(this);
        t.setText("تعذّر الوصول للسيرفر");
        t.setTextColor(TEXT);
        t.setTextSize(19);
        t.setGravity(Gravity.CENTER);
        box.addView(t);

        TextView d = new TextView(this);
        d.setText("تأكد من الرابط، أو أن السيرفر يعمل على Railway.");
        d.setTextColor(MUTED);
        d.setTextSize(13);
        d.setGravity(Gravity.CENTER);
        d.setPadding(0, dp(8), 0, dp(22));
        box.addView(d);

        Button retry = new Button(this);
        retry.setText("إعادة المحاولة");
        retry.setTextColor(Color.WHITE);
        retry.setBackgroundColor(BRAND);
        box.addView(retry);
        Button change = new Button(this);
        change.setText("تغيير رابط السيرفر");
        change.setTextColor(TEXT);
        change.setBackgroundColor(CARD);
        change.setPadding(0, dp(10), 0, dp(10));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(10);
        box.addView(change, lp);

        root.addView(box);

        retry.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) { showApp(server); }
        });
        change.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) { showSetup(); }
        });
    }

    /* ------------------------------- back key ------------------------------- */
    @Override
    public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        String cur = web.getUrl();
        String home = server + "/";
        if (web.canGoBack()) { web.goBack(); return; }
        if (cur != null && !cur.equals(home) && !cur.equals(home + "#/home")) {
            web.loadUrl(home);
            return;
        }
        new AlertDialog.Builder(this)
            .setTitle("MeloVerse")
            .setItems(new CharSequence[]{"تغيير رابط السيرفر", "إعادة تحميل", "خروج"}, new DialogInterface.OnClickListener() {
                public void onClick(DialogInterface d, int which) {
                    if (which == 0) showSetup();
                    else if (which == 1) { if (web != null) web.reload(); }
                    else finish();
                }
            })
            .show();
    }

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    @Override
    protected void onDestroy() {
        if (web != null) { root.removeView(web); web.destroy(); web = null; }
        super.onDestroy();
    }
}
