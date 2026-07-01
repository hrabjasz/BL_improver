

chrome.action.onClicked.addListener((tab) => {
    console.log("Coś działa ?")
    chrome.scripting.executeScript({
        target: {tabId: tab.id},
        files: ['button_worker.js']
    });
});
