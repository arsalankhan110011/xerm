package com.windcast.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import java.util.LinkedHashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String BASE_URL = "file:///android_asset/www/";
    private static final String FALLBACK_PAGE = "index.html";

    private final LinkedHashMap<Integer, String> navTargets = new LinkedHashMap<>();
    private final LinkedHashMap<String, String> pageTitles = new LinkedHashMap<>();
    private final LinkedHashMap<String, String> pageSubtitles = new LinkedHashMap<>();

    private WebView webView;
    private FrameLayout webViewContainer;
    private ProgressBar progressBar;
    private View loadingOverlay;
    private View errorOverlay;
    private TextView errorText;
    private TextView pageTitle;
    private TextView pageSubtitle;
    private TextView loadingText;
    private String currentPage = FALLBACK_PAGE;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            setContentView(R.layout.activity_main);

            seedPageMeta();
            seedNavTargets();

            webViewContainer = findViewById(R.id.webViewContainer);
            progressBar = findViewById(R.id.progressBar);
            loadingOverlay = findViewById(R.id.loadingOverlay);
            errorOverlay = findViewById(R.id.errorOverlay);
            errorText = findViewById(R.id.errorText);
            pageTitle = findViewById(R.id.pageTitle);
            pageSubtitle = findViewById(R.id.pageSubtitle);
            loadingText = findViewById(R.id.loadingText);

            configureButtons();
            configureWebView();

            if (savedInstanceState != null) {
                webView.restoreState(savedInstanceState);
                currentPage = derivePageName(webView.getUrl());
                syncChrome(currentPage);
                showLoading(false, null);
            } else {
                openPage(FALLBACK_PAGE);
            }
        } catch (Throwable throwable) {
            setContentView(R.layout.activity_main);
            pageTitle = findViewById(R.id.pageTitle);
            pageSubtitle = findViewById(R.id.pageSubtitle);
            loadingOverlay = findViewById(R.id.loadingOverlay);
            errorOverlay = findViewById(R.id.errorOverlay);
            errorText = findViewById(R.id.errorText);
            pageTitle.setText("WindCast");
            pageSubtitle.setText("Startup issue");
            showLoading(false, null);
            showError(true, "The app could not initialize on this device. A safer startup path has been applied. Reinstall this updated APK and try again.");
        }
    }

    private void seedPageMeta() {
        pageTitles.put("index.html", "Home");
        pageTitles.put("explore.html", "Explore");
        pageTitles.put("map.html", "Map");
        pageTitles.put("insights.html", "Insights");
        pageTitles.put("methodology.html", "Methodology");
        pageTitles.put("report.html", "Report");

        pageSubtitles.put("index.html", "Research-focused wind analysis for Khyber Pakhtunkhwa");
        pageSubtitles.put("explore.html", "Station filters, charts, recommendations, and scenario estimates");
        pageSubtitles.put("map.html", "Spatial station analysis with layer controls and quick access");
        pageSubtitles.put("insights.html", "Ranking and comparison views for energy potential");
        pageSubtitles.put("methodology.html", "Dataset sources, model assumptions, and evaluation notes");
        pageSubtitles.put("report.html", "Prepare a stakeholder-ready output from the selected analysis");
    }

    private void seedNavTargets() {
        navTargets.put(R.id.navHome, "index.html");
        navTargets.put(R.id.navExplore, "explore.html");
        navTargets.put(R.id.navMap, "map.html");
        navTargets.put(R.id.navInsights, "insights.html");
        navTargets.put(R.id.navMethodology, "methodology.html");
        navTargets.put(R.id.navReport, "report.html");
    }

    private void configureButtons() {
        for (Map.Entry<Integer, String> entry : navTargets.entrySet()) {
            Button button = findViewById(entry.getKey());
            button.setOnClickListener(v -> openPage(entry.getValue()));
        }

        findViewById(R.id.refreshButton).setOnClickListener(v -> {
            showLoading(true, "Refreshing " + pageTitles.getOrDefault(currentPage, "page") + "...");
            webView.reload();
        });

        findViewById(R.id.retryButton).setOnClickListener(v -> openPage(currentPage));

        findViewById(R.id.shareButton).setOnClickListener(v -> shareCurrentSection());
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        webView = new WebView(getApplicationContext());
        webView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        webViewContainer.removeAllViews();
        webViewContainer.addView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setDatabaseEnabled(true);

        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if ("file".equalsIgnoreCase(scheme)) {
                    currentPage = derivePageName(uri.toString());
                    syncChrome(currentPage);
                    return false;
                }
                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme) || "mailto".equalsIgnoreCase(scheme)) {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    return true;
                }
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                currentPage = derivePageName(url);
                syncChrome(currentPage);
                showError(false, null);
                showLoading(true, "Loading " + pageTitles.getOrDefault(currentPage, "page") + "...");
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                currentPage = derivePageName(url);
                syncChrome(currentPage);
                showLoading(false, null);
                showError(false, null);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    showLoading(false, null);
                    showError(true, "The app could not open this section. Some pages still require internet access for live libraries or map tiles.");
                }
            }
        });
    }

    private void openPage(String pageName) {
        currentPage = pageName;
        syncChrome(pageName);
        showError(false, null);
        showLoading(true, "Opening " + pageTitles.getOrDefault(pageName, "page") + "...");
        webView.loadUrl(BASE_URL + pageName);
    }

    private void syncChrome(String pageName) {
        pageTitle.setText(pageTitles.getOrDefault(pageName, "WindCast"));
        pageSubtitle.setText(pageSubtitles.getOrDefault(pageName, "Wind energy forecasting and decision support"));
        syncNavSelection(pageName);
    }

    private void syncNavSelection(String pageName) {
        for (Map.Entry<Integer, String> entry : navTargets.entrySet()) {
            Button button = findViewById(entry.getKey());
            boolean active = pageName.equals(entry.getValue());
            button.setBackgroundResource(active ? R.drawable.nav_button_active : R.drawable.nav_button);
            button.setTextColor(getResources().getColor(active ? android.R.color.white : R.color.app_navy));
        }
    }

    private void shareCurrentSection() {
        String title = pageTitles.getOrDefault(currentPage, "WindCast");
        String text = title + " section in the WindCast Android app";
        Intent shareIntent = new Intent(Intent.ACTION_SEND);
        shareIntent.setType("text/plain");
        shareIntent.putExtra(Intent.EXTRA_SUBJECT, "WindCast - " + title);
        shareIntent.putExtra(Intent.EXTRA_TEXT, text);
        startActivity(Intent.createChooser(shareIntent, "Share via"));
    }

    private void showLoading(boolean visible, String message) {
        loadingOverlay.setVisibility(visible ? View.VISIBLE : View.GONE);
        if (message != null) {
            loadingText.setText(message);
        }
    }

    private void showError(boolean visible, String message) {
        errorOverlay.setVisibility(visible ? View.VISIBLE : View.GONE);
        if (message != null) {
            errorText.setText(message);
        }
    }

    private String derivePageName(String url) {
        if (url == null || !url.contains(".html")) {
            return FALLBACK_PAGE;
        }
        int idx = url.lastIndexOf('/');
        return idx >= 0 ? url.substring(idx + 1) : FALLBACK_PAGE;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webViewContainer.removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
