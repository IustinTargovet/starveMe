document.addEventListener("DOMContentLoaded", function () {
    const donationForm = document.getElementById("donation-form");
    const timeLeftElem = document.getElementById("time-left");
    const elapsedTimeLargeElem = document.getElementById("elapsed-time-large");
    const elapsedTimeSmallElem = document.getElementById("elapsed-time-small");
    const extraStatsElem = document.getElementById("extra-stats");
    const leaderboardBody = document.querySelector("#leaderboard tbody");
  
    const FAST_START = new Date("2025-04-10T20:00:00Z");
    const INITIAL_FAST_MINUTES = 5 * 24 * 60;
  
    donationForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const amount = document.getElementById("amount").value;
      const donorName = document.getElementById("donorName").value;
      const response = await fetch("/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, donorName }),
      });
      const data = await response.json();
      if (data.url) {
        window.location = data.url;
      } else {
        alert("Error creating checkout session.");
      }
    });
  
    async function updateTimers() {
      const res = await fetch("/fast-end");
      const data = await res.json();
      let fastEnd = new Date(data.fastEnd);
      const now = new Date();
      const maxFastEnd = new Date(
        FAST_START.getTime() + 7 * 24 * 60 * 60 * 1000
      );
      if (fastEnd > maxFastEnd) fastEnd = maxFastEnd;
  
      let diff = fastEnd - now;
      if (diff < 0) diff = 0;
  
      const totalSeconds = Math.floor(diff / 1000);
      const days = Math.floor(totalSeconds / (3600 * 24));
      const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
  
      timeLeftElem.textContent = `${days
        .toString()
        .padStart(2, "0")} : ${hours
        .toString()
        .padStart(2, "0")} : ${minutes
        .toString()
        .padStart(2, "0")} : ${seconds.toString().padStart(2, "0")}`;
  
      let elapsed = now - FAST_START;
      if (elapsed < 0) elapsed = 0;
      const totalElapsedMinutes = Math.floor(elapsed / (1000 * 60));
      elapsedTimeLargeElem.textContent = `${totalElapsedMinutes} minutes`;
  
      const elapsedDays = Math.floor(totalElapsedMinutes / 1440);
      const elapsedHours = Math.floor((totalElapsedMinutes % 1440) / 60);
      elapsedTimeSmallElem.textContent = `(${elapsedDays} days, ${elapsedHours} hours)`;
  
      // Additional stats
      const totalFastMinutes = Math.floor((fastEnd - FAST_START) / (1000 * 60));
      const donationMinutes = totalFastMinutes - INITIAL_FAST_MINUTES;
      extraStatsElem.innerHTML = `
        <div class="text-sm text-gray-500 mt-2 space-x-2">
          <span>➕ <strong>${donationMinutes}</strong> mins from donations</span>
          <span>🎯 <strong>${INITIAL_FAST_MINUTES}</strong> initial</span>
          <span>⏱ <strong>${totalFastMinutes}</strong> total</span>
        </div>`;
    }
  
    async function updateLeaderboard() {
      const res = await fetch("/leaderboard");
      const donations = await res.json();
      leaderboardBody.innerHTML = "";
      donations.forEach((donor, i) => {
        const tr = document.createElement("tr");
  
        const emoji =
          i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "";
        const color =
          i === 0
            ? "text-yellow-600"
            : i === 1
            ? "text-gray-600"
            : i === 2
            ? "text-orange-600"
            : "text-gray-800";
  
        const tdName = document.createElement("td");
        tdName.innerHTML = `<span class="text-lg font-bold ${color}">${emoji} ${
          donor.donor_name || "Anonymous"
        }</span>`;
  
        const tdAmount = document.createElement("td");
        tdAmount.textContent = parseFloat(donor.total_donation).toFixed(2);
  
        tr.appendChild(tdName);
        tr.appendChild(tdAmount);
        leaderboardBody.appendChild(tr);
      });
    }
  
    updateTimers();
    setInterval(updateTimers, 1000);
    updateLeaderboard();
    setInterval(updateLeaderboard, 10000);
  });
  