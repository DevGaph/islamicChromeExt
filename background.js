const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(['language'], (result) => {
        if (!result.language) {
            chrome.storage.sync.set({ language: 'en' });
        }
    });
    requestLocationAndFetchPrayerTimes();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name.startsWith('prayerAlarm_')) {
        const prayerName = alarm.name.split('_')[1];
        showPrayerNotification(prayerName);
    } else if (alarm.name === 'updatePrayerTimes') {
        requestLocationAndFetchPrayerTimes();
    }
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    if (notificationId.startsWith('prayer_') && buttonIndex === 0) {
        playAdhan();
    }
});

async function showPrayerNotification(prayerName) {
    const settings = await getSettings();
    const notificationTime = parseInt(settings.notificationTime) || 15;

    chrome.notifications.create(`prayer_${prayerName}`, {
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: chrome.i18n.getMessage('prayerTimeNotificationTitle', [chrome.i18n.getMessage(prayerName)]),
        message: chrome.i18n.getMessage('prayerTimeNotificationMessage', [notificationTime]),
        buttons: [{ title: chrome.i18n.getMessage('playAdhan') }],
        requireInteraction: true
    });
}

async function playAdhan() {
    const settings = await getSettings();
    const volume = (parseInt(settings.adhanVolume) || 50) / 100;
    const audio = new Audio('adhan.mp3');
    audio.volume = volume;
    audio.play();
}

async function fetchPrayerTimes(latitude, longitude) {
    try {
        const date = new Date();
        const timestamp = Math.floor(date.getTime() / 1000);

        const settings = await getSettings();
        const method = settings.calculationMethod || 2;

        const response = await fetch(`http://api.aladhan.com/v1/timings/${timestamp}?latitude=${latitude}&longitude=${longitude}&method=${method}`);
        const data = await response.json();

        console.log("API response:", data);

        if (data && data.data && data.data.timings) {
            const timings = data.data.timings;
            return {
                fajr: timings.Fajr,
                dhuhr: timings.Dhuhr,
                asr: timings.Asr,
                maghrib: timings.Maghrib,
                isha: timings.Isha
            };
        } else {
            console.error("Invalid API response format");
            return null;
        }
    } catch (error) {
        console.error('Error fetching prayer times:', error);
        return null;
    }
}

function getSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['language', 'calculationMethod', 'notificationTime', 'adhanVolume'], resolve);
    });
}

async function schedulePrayerAlarms(times) {
    await chrome.alarms.clearAll();

    const settings = await getSettings();
    const notificationTime = parseInt(settings.notificationTime) || 15;

    prayerNames.forEach((prayer) => {
        const time = times[prayer.toLowerCase()];
        if (time) {
            const [hours, minutes] = time.split(':');
            const alarmTime = new Date();
            alarmTime.setHours(parseInt(hours));
            alarmTime.setMinutes(parseInt(minutes) - notificationTime);
            alarmTime.setSeconds(0);

            if (alarmTime > new Date()) {
                chrome.alarms.create(`prayerAlarm_${prayer}`, {
                    when: alarmTime.getTime()
                });
            }
        }
    });

    const midnight = new Date();
    midnight.setHours(24, 5, 0, 0);
    chrome.alarms.create('updatePrayerTimes', {
        when: midnight.getTime(),
        periodInMinutes: 24 * 60
    });
}

async function fetchAndSchedulePrayerTimes(latitude, longitude) {
    const times = await fetchPrayerTimes(latitude, longitude);
    console.log("Fetched prayer times:", times);

    if (times && Object.values(times).every(time => time)) {
        await schedulePrayerAlarms(times);
        chrome.storage.local.set({ prayerTimes: times }, () => {
            console.log("Prayer times stored in local storage");
        });
        return times;
    } else {
        console.warn('Failed to fetch valid prayer times. Using fallback times.');
        const fallbackTimes = {
            fajr: '05:30',
            dhuhr: '12:30',
            asr: '15:45',
            maghrib: '18:15',
            isha: '19:30'
        };
        await schedulePrayerAlarms(fallbackTimes);
        chrome.storage.local.set({ prayerTimes: fallbackTimes }, () => {
            console.log("Fallback prayer times stored in local storage");
        });
        return fallbackTimes;
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'sendLocation') {
        fetchAndSchedulePrayerTimes(request.latitude, request.longitude)
            .then(times => {
                console.log("Sending prayer times to popup:", times);
                sendResponse({ prayerTimes: times });
            })
            .catch(error => {
                console.error('Error in fetchAndSchedulePrayerTimes:', error);
                sendResponse({ error: 'Failed to fetch prayer times' });
            });
        return true; // Indicates that the response is sent asynchronously
    } else if (request.action === 'updateSettings') {
        requestLocationAndFetchPrayerTimes();
    } else if (request.action === 'updateLanguage') {
        chrome.runtime.reload();
    }
});

function requestLocationAndFetchPrayerTimes() {
    chrome.runtime.sendMessage({ action: 'getLocation' });
}