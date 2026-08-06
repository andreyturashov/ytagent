chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        try {
            const url = new URL(tab.url);
            if (url.hostname === "www.youtube.com" || url.hostname === "youtube.com") {
                const videoId = url.searchParams.get("v");
                if (videoId) {
                    fetch("http://localhost:8000/api/videos/track", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            youtube_video_id: videoId,
                            url: tab.url,
                            user_id: 1,
                        }),
                    }).catch((err) => console.log("Track error:", err));
                }
            }
        } catch (e) {
            // Ignore URL parse errors
        }
    }
});
