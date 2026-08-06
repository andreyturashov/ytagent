async function getCurrentVideoId() {
    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
    });

    if (!tab || !tab.url) {
        return null;
    }

    try {
        const url = new URL(tab.url);
        if (url.hostname !== "www.youtube.com" && url.hostname !== "youtube.com") {
            return null;
        }
        return url.searchParams.get("v");
    } catch {
        return null;
    }
}

function updateVideoStatus(videoId) {
    const statusBadge = document.getElementById("video-status");
    const statusText = document.getElementById("status-text");

    if (videoId) {
        statusBadge.classList.add("active");
        statusText.textContent = `Video: ${videoId.slice(0, 7)}...`;
    } else {
        statusBadge.classList.remove("active");
        statusText.textContent = "No YT Video";
    }
}

function appendMessage(sender, text, isError = false) {
    const chatContainer = document.getElementById("chat-messages");
    const typingIndicator = document.getElementById("typing");

    const messageRow = document.createElement("div");
    messageRow.className = `message-row ${sender.toLowerCase()} ${isError ? "error" : ""}`;

    const senderName = document.createElement("div");
    senderName.className = "message-sender";
    senderName.textContent = sender === "user" ? "You" : "YT Agent";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = text;

    messageRow.appendChild(senderName);
    messageRow.appendChild(bubble);

    // Insert before typing indicator
    chatContainer.insertBefore(messageRow, typingIndicator);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function setTyping(isTyping) {
    const typingIndicator = document.getElementById("typing");
    const sendBtn = document.getElementById("send");

    if (isTyping) {
        typingIndicator.classList.add("visible");
        sendBtn.disabled = true;
    } else {
        typingIndicator.classList.remove("visible");
        sendBtn.disabled = false;
    }

    const chatContainer = document.getElementById("chat-messages");
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function handleSendMessage() {
    const inputEl = document.getElementById("message");
    const message = inputEl.value.trim();

    if (!message) return;

    // Append user message to chat feed
    appendMessage("user", message);

    // Clear input
    inputEl.value = "";
    inputEl.style.height = "42px";

    setTyping(true);

    try {
        const videoId = await getCurrentVideoId();

        const response = await fetch("http://localhost:8005/api/chat", {
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
        });

        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}`);
        }

        const json = await response.json();
        appendMessage("assistant", json.answer || "No response received.");
    } catch (err) {
        console.error("Error sending message:", err);
        appendMessage(
            "assistant",
            `Failed to reach server: ${err.message}. Ensure backend server is running on http://localhost:8005.`,
            true
        );
    } finally {
        setTyping(false);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    // Initial video detection
    const videoId = await getCurrentVideoId();
    updateVideoStatus(videoId);

    if (videoId) {
        fetch("http://localhost:8005/api/videos/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                youtube_video_id: videoId,
                user_id: 1,
            }),
        }).catch((err) => console.log("Track popup error:", err));
    }

    const messageInput = document.getElementById("message");
    const sendBtn = document.getElementById("send");

    sendBtn.addEventListener("click", handleSendMessage);

    // Enter to send (Shift+Enter for newline)
    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // Auto-grow textarea height
    messageInput.addEventListener("input", () => {
        messageInput.style.height = "42px";
        messageInput.style.height = `${Math.min(messageInput.scrollHeight, 100)}px`;
    });
});
