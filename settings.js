function localize() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = chrome.i18n.getMessage(key);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    localize();

    const language = document.getElementById('language');
    const calculationMethod = document.getElementById('calculation-method');
    const notificationTime = document.getElementById('notification-time');
    const adhanVolume = document.getElementById('adhan-volume');
    const saveButton = document.getElementById('save-settings');

    
    chrome.storage.sync.get(['language', 'calculationMethod', 'notificationTime', 'adhanVolume'], (result) => {
        language.value = result.language || 'en';
        calculationMethod.value = result.calculationMethod || '2';
        notificationTime.value = result.notificationTime || '15';
        adhanVolume.value = result.adhanVolume || '50';
    });

    
    saveButton.addEventListener('click', () => {
        chrome.storage.sync.set({
            language: language.value,
            calculationMethod: calculationMethod.value,
            notificationTime: notificationTime.value,
            adhanVolume: adhanVolume.value
        }, () => {
            
            const status = document.createElement('div');
            status.textContent = chrome.i18n.getMessage('settingsSaved');
            status.style.marginTop = '10px';
            status.style.color = 'green';
            status.style.textAlign = 'center';
            document.body.appendChild(status);
            setTimeout(() => {
                status.remove();
            }, 3000);

            
            chrome.runtime.sendMessage({ action: 'updateSettings' });
        });
    });


    language.addEventListener('change', () => {
        chrome.storage.sync.set({ language: language.value }, () => {
            chrome.runtime.sendMessage({ action: 'updateLanguage' });
            window.location.reload();
        });
    });
});