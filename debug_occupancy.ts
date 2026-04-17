import 'dotenv/config';
import { createClient } from '@libsql/client';

const client = createClient({
    url: process.env.PRIVATE_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL || 'file:dev.db',
    authToken: process.env.PRIVATE_TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
});

async function main() {
    const caregiverId = 'usr_3f27c3cb-b838-4359-85af-0583658b82fb';
    const targetDate = '2026-02-27';

    console.log('Querying bookings for caregiver:', caregiverId, 'on date:', targetDate);

    const res = await client.execute({
        sql: `SELECT id, owner_id, status, date_from, date_to, pet_id FROM bookings 
          WHERE caregiver_id = ? 
          AND date_from <= ? 
          AND date_to >= ?`,
        args: [caregiverId, targetDate, targetDate]
    });

    console.log('Active bookings overlapping with 2026-02-27:');
    console.log(JSON.stringify(res.rows, null, 2));

    const profile = await client.execute({
        sql: 'SELECT pet_limit FROM caregiver_profiles WHERE user_id = ?',
        args: [caregiverId]
    });
    console.log('Caregiver pet_limit:', profile.rows[0]?.pet_limit);
}

main().catch(console.error);
