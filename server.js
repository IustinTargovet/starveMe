require('dotenv').config();
const express = require('express');
const fs = require('fs');
const app = express();
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const bodyParser = require('body-parser');

const PORT = process.env.PORT || 3000;

// Serve static assets from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Use raw body parser for the Stripe webhook endpoint
app.use('/webhook', bodyParser.raw({ type: 'application/json' }));

// Fast parameters
const FAST_START = new Date('2025-04-10T00:00:00Z');
const INITIAL_FAST_MINUTES = 5 * 24 * 60; // 5 days in minutes
const MAX_FAST_MINUTES = 7 * 24 * 60; // 7 days in minutes
const MAX_EXTRA_MINUTES = MAX_FAST_MINUTES - INITIAL_FAST_MINUTES; // 2 days in minutes

// Helper functions for reading/writing leaderboard and fast time data
function readDonations() {
    const filePath = path.join(__dirname, 'donations.json');
    if (!fs.existsSync(filePath)) {
        return [];
    }
    return JSON.parse(fs.readFileSync(filePath));
}

function writeDonations(data) {
    const filePath = path.join(__dirname, 'donations.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readFastTime() {
    const filePath = path.join(__dirname, 'fast_time.json');
    if (!fs.existsSync(filePath)) {
        return { extraMinutes: 0 };
    }
    return JSON.parse(fs.readFileSync(filePath));
}

function writeFastTime(data) {
    const filePath = path.join(__dirname, 'fast_time.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Endpoint to create a Stripe Checkout Session
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { amount, donorName } = req.body;
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ error: 'Invalid donation amount.' });
        }
        const donationAmountCents = Math.round(parseFloat(amount) * 100);
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'ideal'],
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: 'Donation',
                    },
                    unit_amount: donationAmountCents,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: req.headers.origin + '/?success=true&session_id={CHECKOUT_SESSION_ID}',
            cancel_url: req.headers.origin + '/?canceled=true',
            metadata: {
                donorName: donorName || 'Anonymous'
            }
        });
        res.json({ url: session.url });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Webhook to handle Stripe events (e.g. payment completed)
app.post('/webhook', (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed.', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        // Donation amount in euros
        const donationAmountEuros = session.amount_total / 100;
        const donorName = session.metadata.donorName || 'Anonymous';

        // Update donations leaderboard
        const donations = readDonations();
        const donorIndex = donations.findIndex(d => d.donorName === donorName);
        if (donorIndex > -1) {
            donations[donorIndex].totalDonation += donationAmountEuros;
        } else {
            donations.push({ donorName: donorName, totalDonation: donationAmountEuros });
        }
        writeDonations(donations);

        // Update fast extra minutes (1€ = 1 minute)
        const fastData = readFastTime();
        const additionalMinutes = donationAmountEuros;
        fastData.extraMinutes = Math.min(fastData.extraMinutes + additionalMinutes, MAX_EXTRA_MINUTES);
        writeFastTime(fastData);
    }

    res.json({ received: true });
});

// Endpoint to serve leaderboard data
app.get('/leaderboard', (req, res) => {
    const donations = readDonations();
    donations.sort((a, b) => b.totalDonation - a.totalDonation);
    res.json(donations);
});

// Endpoint to serve the current fast end time
app.get('/fast-end', (req, res) => {
    const fastData = readFastTime();
    const initialEnd = new Date(FAST_START.getTime() + INITIAL_FAST_MINUTES * 60000);
    const fastEnd = new Date(initialEnd.getTime() + fastData.extraMinutes * 60000);
    res.json({ fastEnd: fastEnd.toISOString() });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
