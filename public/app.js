document.addEventListener("DOMContentLoaded", function() {
    const donationForm = document.getElementById('donation-form');
    const timeLeftElem = document.getElementById('time-left');
    const elapsedTimeLargeElem = document.getElementById('elapsed-time-large');
    const elapsedTimeSmallElem = document.getElementById('elapsed-time-small');
    const leaderboardBody = document.querySelector('#leaderboard tbody');
    
    const FAST_START = new Date('2025-04-10T20:00:00Z');
    const INITIAL_FAST_DURATION = 5 * 24 * 60 * 60 * 1000; // still used on the backend
    
    donationForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = document.getElementById('amount').value;
      const donorName = document.getElementById('donorName').value;
      const response = await fetch('/create-checkout-session', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ amount, donorName })
      });
      const data = await response.json();
      if (data.url) {
        window.location = data.url;
      } else {
        alert('Error creating checkout session.');
      }
    });
    
    // Update timer displays
    async function updateTimers() {
      const res = await fetch('/fast-end');
      const data = await res.json();
      let fastEnd = new Date(data.fastEnd);
      const now = new Date();
    
      // Enforce a maximum of 7 days from FAST_START
      const maxFastEnd = new Date(FAST_START.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (fastEnd > maxFastEnd) {
        fastEnd = maxFastEnd;
      }
    
      // Calculate remaining time in days, hours, minutes and seconds
      let diff = fastEnd - now;
      if (diff < 0) diff = 0;
      const totalSeconds = Math.floor(diff / 1000);
      const days = Math.floor(totalSeconds / (3600 * 24));
      const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
    
      // Update the main timer (big & centered)
      timeLeftElem.textContent = `${days.toString().padStart(2, '0')}d : ${hours.toString().padStart(2, '0')}h : ${minutes.toString().padStart(2, '0')}m : ${seconds.toString().padStart(2, '0')}s`;
    
      // Calculate elapsed fast time in minutes since FAST_START
      let elapsed = now - FAST_START;
      if (elapsed < 0) elapsed = 0;
      const totalElapsedMinutes = Math.floor(elapsed / (1000 * 60));
      elapsedTimeLargeElem.textContent = `${totalElapsedMinutes} minutes`;
    
      // Also calculate a breakdown in days and hours (displayed smaller)
      const elapsedDays = Math.floor(totalElapsedMinutes / 1440); // 1440 minutes in a day
      const elapsedHours = Math.floor((totalElapsedMinutes % 1440) / 60);
      elapsedTimeSmallElem.textContent = `(${elapsedDays} days, ${elapsedHours} hours)`;
    }
    
    // Update leaderboard data
    async function updateLeaderboard() {
      const res = await fetch('/leaderboard');
      const donations = await res.json();
      leaderboardBody.innerHTML = '';
      donations.forEach(donor => {
        const tr = document.createElement('tr');
        const tdName = document.createElement('td');
        // Use the appropriate field key (depending on your database column names)
        tdName.textContent = donor.donor_name || donor.donorName;
        const tdAmount = document.createElement('td');
        tdAmount.textContent = parseFloat(donor.total_donation).toFixed(2);
        tr.appendChild(tdName);
        tr.appendChild(tdAmount);
        leaderboardBody.appendChild(tr);
      });
    }
    
    // Refresh timers and leaderboard regularly
    updateTimers();
    setInterval(updateTimers, 1000); // update timers every second
    updateLeaderboard();
    setInterval(updateLeaderboard, 10000);
  });
  