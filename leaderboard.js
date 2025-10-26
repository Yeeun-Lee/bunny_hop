// Leaderboard Manager
class LeaderboardManager {
    constructor() {
        this.scores = [];
        this.isLoading = false;
    }

    async loadScores() {
        if (!LEADERBOARD_ENABLED || !API_URL || API_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
            console.log('Leaderboard is disabled or API URL not configured');
            return [];
        }

        this.isLoading = true;
        try {
            const response = await fetch(`${API_URL}?action=getTop10`);
            const data = await response.json();

            if (data.success) {
                this.scores = data.scores;
                return this.scores;
            } else {
                console.error('Failed to load leaderboard:', data.error);
                return [];
            }
        } catch (error) {
            console.error('Error loading leaderboard:', error);
            return [];
        } finally {
            this.isLoading = false;
        }
    }

    async submitScore(score, initial) {
        if (!LEADERBOARD_ENABLED || !API_URL || API_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
            console.log('Leaderboard is disabled or API URL not configured');
            return false;
        }

        try {
            const formData = new URLSearchParams();
            formData.append('action', 'addScore');
            formData.append('score', score);
            formData.append('initial', initial.toUpperCase());

            const response = await fetch(API_URL, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Error submitting score:', error);
            return false;
        }
    }

    isTopTen(score) {
        // If we have less than 10 scores, it's automatically top 10
        if (this.scores.length < 10) {
            return true;
        }

        // Check if score is higher than the 10th place
        const tenthPlaceScore = this.scores[9].score;
        return score > tenthPlaceScore;
    }

    displayLeaderboard(containerElement) {
        if (this.isLoading) {
            containerElement.innerHTML = '<div class="loading">Loading...</div>';
            return;
        }

        if (this.scores.length === 0) {
            containerElement.innerHTML = '<div class="loading">No scores yet. Be the first!</div>';
            return;
        }

        let html = '';
        this.scores.forEach((entry, index) => {
            const rank = index + 1;
            const rankClass = rank <= 3 ? `rank-${rank}` : '';

            html += `
                <div class="leaderboard-entry ${rankClass}">
                    <span class="entry-rank">#${rank}</span>
                    <span class="entry-initial">${entry.initial}</span>
                    <span class="entry-score">${entry.score}m</span>
                </div>
            `;
        });

        containerElement.innerHTML = html;
    }
}

// Global leaderboard instance
const leaderboard = new LeaderboardManager();

// UI Controller for Leaderboard
class LeaderboardUI {
    constructor() {
        this.leaderboardScreen = document.getElementById('leaderboardScreen');
        this.leaderboardList = document.getElementById('leaderboardList');
        this.closeButton = document.getElementById('closeLeaderboard');
        this.leaderboardButton = document.getElementById('leaderboardButton');
        this.viewLeaderboardBtn = document.getElementById('viewLeaderboardBtn');

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.closeButton.addEventListener('click', () => {
            this.hide();
        });

        this.leaderboardButton.addEventListener('click', () => {
            this.show();
        });

        this.viewLeaderboardBtn.addEventListener('click', () => {
            this.show();
        });
    }

    async show() {
        this.leaderboardScreen.classList.remove('hidden');
        this.leaderboardList.innerHTML = '<div class="loading">Loading...</div>';

        await leaderboard.loadScores();
        leaderboard.displayLeaderboard(this.leaderboardList);
    }

    hide() {
        this.leaderboardScreen.classList.add('hidden');
    }
}

// Initialize leaderboard UI when DOM is ready
let leaderboardUI;
document.addEventListener('DOMContentLoaded', () => {
    leaderboardUI = new LeaderboardUI();
});
