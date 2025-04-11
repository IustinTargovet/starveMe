document.addEventListener("DOMContentLoaded", function() {
    const donationForm = document.getElementById('donation-form');
    const timeLeftElem = document.getElementById('time-left');
    const elapsedTimeElem = document.getElementById('elapsed-time');
    const leaderboardBody = document.querySelector('#leaderboard tbody');
  
    const FAST_START = new Date('2025-04-10T00:00:00Z');
    const INITIAL_FAST_DURATION = 5 * 24 * 60 * 60 * 1000; // 5 days in ms
  
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
      const fastEnd = new Date(data.fastEnd);
      const now = new Date();
  
      // Time left calculation
      let diff = fastEnd - now;
      if (diff < 0) diff = 0;
      const minutesLeft = Math.floor(diff / (1000 * 60));
      const hoursLeft = Math.floor(minutesLeft / 60);
      const daysLeft = Math.floor(hoursLeft / 24);
      const remainingHours = hoursLeft % 24;
      const remainingMinutes = minutesLeft % 60;
      timeLeftElem.textContent = `${daysLeft} days, ${remainingHours} hours, ${remainingMinutes} minutes`;
  
      // Elapsed time calculation
      let elapsed = now - FAST_START;
      if (elapsed < 0) elapsed = 0;
      const elapsedMinutes = Math.floor(elapsed / (1000 * 60));
      const elapsedHours = Math.floor(elapsedMinutes / 60);
      const elapsedDays = Math.floor(elapsedHours / 24);
      const remainingElapsedHours = elapsedHours % 24;
      const remainingElapsedMinutes = elapsedMinutes % 60;
      elapsedTimeElem.textContent = `${elapsedDays} days, ${remainingElapsedHours} hours, ${remainingElapsedMinutes} minutes`;
    }
  
    // Update leaderboard data
    async function updateLeaderboard() {
      const res = await fetch('/leaderboard');
      const donations = await res.json();
      leaderboardBody.innerHTML = '';
      donations.forEach(donor => {
        const tr = document.createElement('tr');
        const tdName = document.createElement('td');
        tdName.textContent = donor.donorName;
        const tdAmount = document.createElement('td');
        tdAmount.textContent = donor.totalDonation.toFixed(2);
        tr.appendChild(tdName);
        tr.appendChild(tdAmount);
        leaderboardBody.appendChild(tr);
      });
    }
  
    // Refresh timers and leaderboard regularly
    updateTimers();
    setInterval(updateTimers, 1000);
    updateLeaderboard();
    setInterval(updateLeaderboard, 10000);
  });
  