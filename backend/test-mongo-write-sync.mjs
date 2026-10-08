import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });

const uri = process.env.MONGODB_URI || "mongodb://tmp_wayahe:tmp_wayahe@127.0.0.1:27017/wayahetopup1?authSource=wayahetopup1";
const dbName = process.env.MONGODB_DBNAME || "wayahetopup1";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function runTest() {
  try {
    console.log('Connecting to MongoDB for write/sync verification...');
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('settings_sync_test');

    const testDoc = {
      key: 'test_sync_key',
      updatedAt: new Date(),
      payload: {
        digiflazzUsername: process.env.DIGIFLAZZ_USERNAME,
        ipWhitelist: '43.159.33.27',
        status: 'stable'
      }
    };

    console.log('Writing test document...');
    await collection.updateOne(
      { key: 'test_sync_key' },
      { $set: testDoc },
      { upsert: true }
    );

    console.log('Reading back test document...');
    const result = await collection.findOne({ key: 'test_sync_key' });
    console.log('Successfully read back document:', JSON.stringify(result, null, 2));

    if (result && result.payload && result.payload.status === 'stable') {
      console.log('MongoDB write/sync verification PASSED successfully!');
    } else {
      throw new Error('Retrieved document did not match expected sync state.');
    }
  } catch (err) {
    console.error('MongoDB write/sync test FAILED:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

runTest();
