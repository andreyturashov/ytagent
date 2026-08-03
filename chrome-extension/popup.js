async function getCurrentVideoId() {
    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
    });

    if (!tab.url) {
        return null;
    }

    const url = new URL(tab.url);

    if (url.hostname !== "www.youtube.com") {
        return null;
    }

    return url.searchParams.get("v");
}

document
    .getElementById("send")
    .addEventListener("click", async () => {

        const message =
            document.getElementById("message").value;

        const videoId =
            await getCurrentVideoId();

        const response = await fetch(
            "http://localhost:8000/chat",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                },

                body: JSON.stringify({
                    user_id: 1,
                    chat_id: 1,
                    video_id: videoId,
                    message,
                }),
            },
        );

        const json = await response.json();

        document.getElementById("answer").textContent =
            json.answer;
    });
