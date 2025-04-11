require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize PostgreSQL pool using the DATABASE_URL environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Serve static assets from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Use raw body parser for the Stripe webhook endpoint
app.use('/webhook', bodyParser.raw({ type: 'application/json' }));

// Fast parameters
const FAST_START = new Date('2025-04-10T20:00:00Z');
const INITIAL_FAST_MINUTES = 5 * 24 * 60; // 5 days in minutes
const MAX_FAST_MINUTES = 7 * 24 * 60; // 7 days in minutes
const MAX_EXTRA_MINUTES = MAX_FAST_MINUTES - INITIAL_FAST_MINUTES; // extra minutes possible

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
app.post('/webhook', async (req, res) => {
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

    try {
      // Update donations table
      const result = await pool.query(
        'SELECT id, total_donation FROM donations WHERE donor_name = $1',
        [donorName]
      );

      if (result.rowCount > 0) {
        // Update existing donation amount
        await pool.query(
          'UPDATE donations SET total_donation = total_donation + $1 WHERE donor_name = $2',
          [donationAmountEuros, donorName]
        );
      } else {
        // Insert new donation record
        await pool.query(
          'INSERT INTO donations (donor_name, total_donation) VALUES ($1, $2)',
          [donorName, donationAmountEuros]
        );
      }

      // Update fast extra minutes in fast_settings (1€ = 1 minute)
      const fastResult = await pool.query('SELECT id, extra_minutes FROM fast_settings LIMIT 1');
      let extraMinutes = 0;
      let recordId = null;
      if (fastResult.rowCount > 0) {
        recordId = fastResult.rows[0].id;
        extraMinutes = fastResult.rows[0].extra_minutes;
      }

      const additionalMinutes = donationAmountEuros * 5;
      const newExtraMinutes = Math.min(extraMinutes + additionalMinutes, MAX_EXTRA_MINUTES);

      if (recordId !== null) {
        await pool.query(
          'UPDATE fast_settings SET extra_minutes = $1 WHERE id = $2',
          [newExtraMinutes, recordId]
        );
      } else {
        // Should not happen if we initialized the table correctly
        await pool.query(
          'INSERT INTO fast_settings (extra_minutes) VALUES ($1)',
          [newExtraMinutes]
        );
      }
    } catch (err) {
      console.error('Error updating database from webhook:', err);
    }
  }

  res.json({ received: true });
});

// Endpoint to serve leaderboard data
app.get('/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT donor_name, total_donation FROM donations ORDER BY total_donation DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint to serve the current fast end time
app.get('/fast-end', async (req, res) => {
  try {
    const fastResult = await pool.query('SELECT extra_minutes FROM fast_settings LIMIT 1');
    let extraMinutes = 0;
    if (fastResult.rowCount > 0) {
      extraMinutes = fastResult.rows[0].extra_minutes;
    }
    const initialEnd = new Date(FAST_START.getTime() + INITIAL_FAST_MINUTES * 60000);
    const fastEnd = new Date(initialEnd.getTime() + extraMinutes * 60000);
    res.json({ fastEnd: fastEnd.toISOString() });
  } catch (err) {
    console.error('Error fetching fast end time:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
