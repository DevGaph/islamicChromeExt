const prayerNames = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

function localize() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = chrome.i18n.getMessage(key);
    });
}


function updatePrayerTimes(times) {
    console.log("Updating prayer times with:", times);
    const prayerList = document.getElementById('prayer-list');
    prayerList.innerHTML = '';

    prayerNames.forEach((prayer) => {
        if (prayer !== 'sunrise') {
            const time = times[prayer] || 'N/A';
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <div class="prayer-name">
                    <span data-i18n="${prayer}">${chrome.i18n.getMessage(prayer)}</span>
                </div>
                <span class="prayer-time">${time}</span>
            `;
            prayerList.appendChild(listItem);
        }
    });
}

function updateNextPrayer(nextPrayer) {
    const nextPrayerName = document.getElementById('next-prayer-name');
    const nextPrayerTime = document.getElementById('next-prayer-time');

    nextPrayerName.textContent = chrome.i18n.getMessage(nextPrayer.name);
    nextPrayerTime.textContent = nextPrayer.time;
}

function calculateNextPrayer(times) {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    for (const prayer of prayerNames) {
        if (prayer !== 'sunrise' && times[prayer]) {
            const [hours, minutes] = times[prayer].split(':');
            if (hours && minutes) {
                const prayerTime = parseInt(hours) * 60 + parseInt(minutes);
                if (prayerTime > currentTime) {
                    return { name: prayer, time: times[prayer] };
                }
            }
        }
    }

    // If no next prayer found, return the first prayer of the next day
    return { name: 'fajr', time: times.fajr || '05:30' };
}

function updateQiblaDirection(latitude, longitude) {
    const qiblaCompass = document.getElementById('qibla-compass');
    const qiblaLatitude = 21.4225;
    const qiblaLongitude = 39.8262;

    const φ1 = latitude * Math.PI / 180;
    const φ2 = qiblaLatitude * Math.PI / 180;
    const Δλ = (qiblaLongitude - longitude) * Math.PI / 180;

    const y = Math.sin(Δλ);
    const x = Math.cos(φ1) * Math.tan(φ2) - Math.sin(φ1) * Math.cos(Δλ);
    let qiblaDirection = Math.atan2(y, x) * 180 / Math.PI;
    qiblaDirection = (qiblaDirection + 360) % 360;

    qiblaCompass.style.transform = `rotate(${qiblaDirection}deg)`;
    qiblaCompass.innerHTML = `
        <svg viewBox="0 0 100 100">
            <polygon points="50,0 45,40 55,40" fill="#1976d2" />
            <circle cx="50" cy="50" r="45" fill="none" stroke="#1976d2" stroke-width="2" />
            <text x="50" y="65" text-anchor="middle" fill="#1976d2" font-size="12">${Math.round(qiblaDirection)}°</text>
        </svg>
    `;
}

function updateIslamicDate() {
    const today = new Date();
    const islamicDate = new Intl.DateTimeFormat('en-u-ca-islamic', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(today);

    document.getElementById('hijri-date').textContent = islamicDate;
}

async function fetchPrayerTimes() {
    try {
        const position = await getCurrentPosition();
        const { latitude, longitude } = position.coords;

        updateQiblaDirection(latitude, longitude);

        // Retrieve prayer times from Chrome storage
        chrome.storage.local.get('prayerTimes', (result) => {
            console.log("Retrieved prayer times from storage:", result.prayerTimes);
            if (result.prayerTimes) {
                updatePrayerTimes(result.prayerTimes);
                const nextPrayer = calculateNextPrayer(result.prayerTimes);
                updateNextPrayer(nextPrayer);
            } else {
                console.log("No stored prayer times, requesting new times");
                // Request new prayer times if not found in storage
                chrome.runtime.sendMessage({
                    action: 'sendLocation',
                    latitude,
                    longitude
                }, response => {
                    console.log("Received response from background:", response);
                    if (chrome.runtime.lastError) {
                        console.error('Error sending location:', chrome.runtime.lastError);
                        useFallbackTimes();
                    } else {
                        // After requesting new times, retrieve them from storage
                        chrome.storage.local.get('prayerTimes', (result) => {
                            if (result.prayerTimes) {
                                updatePrayerTimes(result.prayerTimes);
                                const nextPrayer = calculateNextPrayer(result.prayerTimes);
                                updateNextPrayer(nextPrayer);
                            } else {
                                console.warn("Failed to retrieve prayer times, using fallback");
                                useFallbackTimes();
                            }
                        });
                    }
                });
            }
        });
    } catch (error) {
        console.error('Error fetching prayer times:', error);
        useFallbackTimes();
    }
}

function useFallbackTimes() {
    const fallbackTimes = {
        fajr: '05:30',
        sunrise: '06:45',
        dhuhr: '12:30',
        asr: '15:45',
        maghrib: '18:15',
        isha: '19:30'
    };
    updatePrayerTimes(fallbackTimes);
    const nextPrayer = calculateNextPrayer(fallbackTimes);
    updateNextPrayer(nextPrayer);
}

function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    localize();
    fetchPrayerTimes();
    updateIslamicDate();

    const settingsButton = document.querySelector('.settings-button');
    settingsButton.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
});

function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const segments = document.querySelectorAll('.segment');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            
            // Remove active class from all tabs and segments
            tabs.forEach(t => t.classList.remove('active'));
            segments.forEach(s => s.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding segment
            tab.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// Modify your existing DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    localize();
    fetchPrayerTimes();
    updateIslamicDate();
    setupTabs(); // Add this line to set up tab functionality

    const settingsButton = document.querySelector('.settings-button');
    settingsButton.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
});

setInterval(fetchPrayerTimes, 60 * 60 * 1000);

setInterval(updateIslamicDate, 24 * 60 * 60 * 1000);