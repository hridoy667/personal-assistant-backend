/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { PrismaClient, PolicyType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const districts = [
  // Dhaka Division
  { id: 1, name: 'Dhaka', latitude: 23.8103, longitude: 90.4125 },
  { id: 2, name: 'Gazipur', latitude: 24.0023, longitude: 90.4264 },
  { id: 3, name: 'Narayanganj', latitude: 23.6238, longitude: 90.5 },
  { id: 4, name: 'Tangail', latitude: 24.2513, longitude: 89.9167 },
  { id: 5, name: 'Faridpur', latitude: 23.6071, longitude: 89.8429 },
  { id: 6, name: 'Manikganj', latitude: 23.8644, longitude: 90.0047 },
  { id: 7, name: 'Munshiganj', latitude: 23.5422, longitude: 90.5353 },
  { id: 8, name: 'Rajbari', latitude: 23.7574, longitude: 89.6444 },
  { id: 9, name: 'Madaripur', latitude: 23.1641, longitude: 90.1896 },
  { id: 10, name: 'Gopalganj', latitude: 23.005, longitude: 89.8267 },
  { id: 11, name: 'Shariatpur', latitude: 23.2423, longitude: 90.4348 },
  { id: 12, name: 'Narsingdi', latitude: 23.923, longitude: 90.7181 },
  { id: 13, name: 'Kishoreganj', latitude: 24.4449, longitude: 90.7766 },

  // Chattogram Division
  { id: 14, name: 'Chattogram', latitude: 22.3569, longitude: 91.7832 },
  { id: 15, name: "Cox's Bazar", latitude: 21.4272, longitude: 92.0058 },
  { id: 16, name: 'Cumilla', latitude: 23.4607, longitude: 91.1809 },
  { id: 17, name: 'Feni', latitude: 23.0159, longitude: 91.3976 },
  { id: 18, name: 'Brahmanbaria', latitude: 23.9571, longitude: 91.1119 },
  { id: 19, name: 'Noakhali', latitude: 22.8696, longitude: 91.0994 },
  { id: 20, name: 'Lakshmipur', latitude: 22.9425, longitude: 90.8417 },
  { id: 21, name: 'Chandpur', latitude: 23.2333, longitude: 90.65 },
  { id: 22, name: 'Rangamati', latitude: 22.6533, longitude: 92.175 },
  { id: 23, name: 'Khagrachhari', latitude: 23.1192, longitude: 91.9847 },
  { id: 24, name: 'Bandarban', latitude: 22.1953, longitude: 92.2184 },

  // Rajshahi Division
  { id: 25, name: 'Rajshahi', latitude: 24.3745, longitude: 88.6042 },
  { id: 26, name: 'Bogra', latitude: 24.8481, longitude: 89.373 },
  { id: 27, name: 'Pabna', latitude: 24.0063, longitude: 89.2493 },
  { id: 28, name: 'Sirajganj', latitude: 24.4534, longitude: 89.7077 },
  { id: 29, name: 'Naogaon', latitude: 24.8054, longitude: 88.9479 },
  { id: 30, name: 'Natore', latitude: 24.4102, longitude: 88.9595 },
  { id: 31, name: 'Chapai Nawabganj', latitude: 24.5965, longitude: 88.271 },
  { id: 32, name: 'Joypurhat', latitude: 25.0947, longitude: 89.0209 },

  // Khulna Division
  { id: 33, name: 'Khulna', latitude: 22.8456, longitude: 89.5403 },
  { id: 34, name: 'Jessore', latitude: 23.1664, longitude: 89.2137 },
  { id: 35, name: 'Satkhira', latitude: 22.7185, longitude: 89.0705 },
  { id: 36, name: 'Bagerhat', latitude: 22.6516, longitude: 89.7859 },
  { id: 37, name: 'Kushtia', latitude: 23.9013, longitude: 89.1204 },
  { id: 38, name: 'Magura', latitude: 23.4873, longitude: 89.4199 },
  { id: 39, name: 'Meherpur', latitude: 23.7622, longitude: 88.6318 },
  { id: 40, name: 'Narail', latitude: 23.1725, longitude: 89.5126 },
  { id: 41, name: 'Chuadanga', latitude: 23.6401, longitude: 88.8418 },
  { id: 42, name: 'Jhenaidah', latitude: 23.545, longitude: 89.1726 },

  // Sylhet Division
  { id: 43, name: 'Sylhet', latitude: 24.8949, longitude: 91.8687 },
  { id: 44, name: 'Moulvibazar', latitude: 24.4829, longitude: 91.7705 },
  { id: 45, name: 'Habiganj', latitude: 24.3749, longitude: 91.4124 },
  { id: 46, name: 'Sunamganj', latitude: 25.0658, longitude: 91.3958 },

  // Barisal Division
  { id: 47, name: 'Barisal', latitude: 22.701, longitude: 90.3535 },
  { id: 48, name: 'Bhola', latitude: 22.6859, longitude: 90.6417 },
  { id: 49, name: 'Patuakhali', latitude: 22.3596, longitude: 90.3297 },
  { id: 50, name: 'Pirojpur', latitude: 22.5841, longitude: 89.972 },
  { id: 51, name: 'Jhalokati', latitude: 22.6422, longitude: 90.2003 },
  { id: 52, name: 'Barguna', latitude: 22.1504, longitude: 90.1221 },

  // Rangpur Division
  { id: 53, name: 'Rangpur', latitude: 25.7439, longitude: 89.2752 },
  { id: 54, name: 'Dinajpur', latitude: 25.6217, longitude: 88.6354 },
  { id: 55, name: 'Kurigram', latitude: 25.8054, longitude: 89.6361 },
  { id: 56, name: 'Gaibandha', latitude: 25.3287, longitude: 89.528 },
  { id: 57, name: 'Lalmonirhat', latitude: 25.9126, longitude: 89.4426 },
  { id: 58, name: 'Nilphamari', latitude: 25.9317, longitude: 88.856 },
  { id: 59, name: 'Panchagarh', latitude: 26.3411, longitude: 88.5541 },
  { id: 60, name: 'Thakurgaon', latitude: 26.0337, longitude: 88.4617 },

  // Mymensingh Division
  { id: 61, name: 'Mymensingh', latitude: 24.7471, longitude: 90.4203 },
  { id: 62, name: 'Jamalpur', latitude: 24.9197, longitude: 89.9454 },
  { id: 63, name: 'Netrokona', latitude: 24.8705, longitude: 90.7273 },
  { id: 64, name: 'Sherpur', latitude: 25.0188, longitude: 90.0175 },
];

const TERMS_OF_SERVICE_VERSION = '1.0.0';

const TERMS_OF_SERVICE_CONTENT = `Last Updated: July 14, 2026
Effective Date: July 14, 2026

Welcome to Organic Haat! Please read these Terms of Service ("Terms") carefully. By accessing, browsing, registering for, or using our platform, mobile application, or any associated AI-driven chat services (collectively, the "Platform"), you agree to be bound by these Terms and our Privacy Policy. If you do not agree to all of these Terms, you must not register an account or use our services.

These Terms constitute a binding legal agreement between you and Organic Haat under the Contract Act, 1872, the Sale of Goods Act, 1930, the Consumer Rights Protection Act, 2009, the Information and Communication Technology (ICT) Act, 2006, and the Cyber Security Act of Bangladesh.

---

## 1. Organic Haat is Only a Marketplace
Organic Haat operates strictly as an intermediary digital marketplace ("Platform") facilitating transactions between independent sellers (such as farmers, local growers, and nearby verified meat/fish vendors, collectively referred to as "Sellers") and buyers ("Customers").

### 1.1 Owner of Products
Organic Haat does not produce, grow, process, harvest, package, slaughter, certify, or own any of the products listed on the Platform. All products are owned, possessed, and offered for sale exclusively by the independent Sellers.

### 1.2 Facilitator Status
We are not a food processor, transporter, slaughterhouse, or quality certification body. We only facilitate transactions, communications, and logistical routing. Any contract of sale for products listed on the Platform is strictly between the Buyer and the Seller.

### 1.3 Fraudulent Sellers
While we are not responsible for Seller conduct, Organic Haat reserves the absolute right to suspend, terminate, or blacklist any Seller or Customer found engaging in fraudulent activity, misrepresentation, or violating Bangladeshi consumer rights frameworks.

---

## 2. Farmer-Specific Marketplace Rules
Farmers and agricultural Sellers operating on Organic Haat are independent operators.

### 2.1 Product Ownership & Listings
Farmers own their respective inventories until ownership transfer occurs upon successful delivery to the Customer.

### 2.2 Stock Availability
Farmers are solely responsible for keeping their product stock levels, weights, units, and availability metrics updated. Organic Haat is not liable for orders canceled due to a Seller's sudden stock depletion.

### 2.3 Quality Responsibility
Sellers bear complete responsibility for the safety, organic claims, freshness, grade, and quality of their items under the Consumer Rights Protection Act, 2009.

---

## 3. Nearby Fish/Meat Shops & Freshness Disclaimer
To ensure fresh delivery of highly perishable animal proteins, the Platform routes orders dynamically to verified local vendors closest to the Customer's shipping district.

### 3.1 Local Routing
Orders containing fish, beef, chicken, dairy, or eggs are mapped and routed to nearby verified partner merchants within your designated municipality or district.

### 3.2 Service Availability
Delivery timelines, availability, and routing are subject to active logistical coverage, courier availability, weather, and traffic conditions within the respective district.

### 3.3 Cold-Chain & Freshness Disclaimer
Organic Haat does not operate refrigerated cold-chain transport vehicles. Due to the tropical climate of Bangladesh, freshness and raw temperature preservation cannot be guaranteed beyond the point of physical handover to the courier and immediate delivery.

### 3.4 Immediate Inspection
Because fish, beef, chicken, eggs, and dairy are highly perishable and prone to rapid bacterial growth or contamination if left unrefrigerated, Customers must physically inspect these items immediately upon delivery. Once a delivery is accepted and signed for, no claims regarding spoilage, odor, or temperature degradation will be entertained.

---

## 4. AI Communication & Customer Support
Organic Haat uses advanced Artificial Intelligence (AI) assistants to facilitate customer support, product discovery, order inquiries, and direct communication between users and verified sellers.

### 4.1 No Legal Authority
AI assistants and automated chatbots do not make legal decisions, represent binding corporate guarantees, or possess the authority to modify these Terms, issue refunds, or waive Platform policies.

### 4.2 Error Disclaimer
AI models use probabilistic algorithms and can make mistakes, hallucinate incorrect inventory data, or display inaccurate pricing suggestions. All AI-generated responses are provided on an "as-is" basis.

### 4.3 Human Override
In the event of a dispute, error, or incorrect instruction issued by an AI assistant, human customer support representatives will review the transaction history and possess absolute overriding authority.

### 4.4 Continuous Improvement
Your conversations with our AI assistants may be monitored, logged, and analyzed to improve conversational accuracy, fine-tune system prompts, and optimize customer experience.

---

## 5. Financial Compliance & Tax Requirements
In compliance with the National Board of Revenue (NBR) of Bangladesh, all transactions processed through the Platform are subject to applicable Value Added Tax (VAT), supplementary duties, and withholding tax laws. Sellers are responsible for declaring their income, and Organic Haat will apply platform commission fees alongside government-mandated taxes on checkouts where required by Bangladeshi tax codes.

---

## 6. Future-Proofing & Services Expansion
Organic Haat reserves the right to introduce, modify, or retire the following platform features, services, and commercial models at any time without prior individual consent:
* **Premium Memberships:** Paid subscription tiers for Customers and Premium Farmers.
* **Advertisements:** Sponsored product listings, banner ads, and marketing features.
* **AI Autonomous Agents:** Self-negotiating agents, automated restocking triggers, and predictive buying.
* **Platform Wallets & BNPL:** Digital credit ledgers, Buy Now Pay Later (BNPL) schemes, and micro-credit financing.
* **Loyalty Programs:** Points, reward structures, digital gift cards, and refer-a-friend promotions.
* **B2B & Auctions:** Live wholesale bidding, bulk agricultural auctions, and institutional crop pre-sales.

---

## 7. Limitation of Liability & Indemnity
To the maximum extent permitted by applicable law, Organic Haat, its directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, crop failure, spoiled inventories, foodborne illnesses, or system downtimes arising out of your use of the platform. You agree to indemnify and hold harmless Organic Haat from any third-party claims, damages, or legal expenses arising from your violation of these Terms or infringement of consumer rights.`;

// --- PRIVACY POLICY COMMENTED OUT ---
// const PRIVACY_POLICY_VERSION = '1.0.0';
// const PRIVACY_POLICY_CONTENT = `...`;

async function seedCoreData() {
  console.log('🚀 Syncing Districts...');
  for (const d of districts) {
    await prisma.districts.upsert({
      where: { name: d.name },
      update: {
        latitude: d.latitude,
        longitude: d.longitude,
      },
      create: {
        id: d.id,
        name: d.name,
        latitude: d.latitude,
        longitude: d.longitude,
      },
    });
  }
  console.log('✅ 64 Districts Seeded.');

  console.log('👑 Seeding Admin...');
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@evo.com' },
    update: { password: hashedPassword, type: 'ADMIN', isVerified: true },
    create: {
      email: 'admin@evo.com',
      password: hashedPassword,
      name: 'Super Admin',
      userName: 'admin',
      type: 'ADMIN',
      isVerified: true,
      status: 1,
    },
  });
  console.log('✅ Admin seeded successfully.');
}

async function seedTermsOfService() {
  console.log('📜 Seeding Terms of Service...');
  await prisma.legals.upsert({
    where: {
      type_version: {
        type: PolicyType.TERMS_OF_SERVICE,
        version: TERMS_OF_SERVICE_VERSION,
      },
    },
    update: {
      content: TERMS_OF_SERVICE_CONTENT,
      isActive: true,
    },
    create: {
      type: PolicyType.TERMS_OF_SERVICE,
      version: TERMS_OF_SERVICE_VERSION,
      content: TERMS_OF_SERVICE_CONTENT,
      isActive: true,
    },
  });
  console.log('✅ Terms of Service seeded successfully.');
}

/* --- PRIVACY POLICY SEED FUNCTION COMMENTED OUT ---
async function seedPrivacyPolicy() {
  console.log('📜 Seeding Privacy Policy...');
  await prisma.legals.upsert({
    where: {
      type_version: {
        type: PolicyType.PRIVACY_POLICY,
        version: PRIVACY_POLICY_VERSION,
      },
    },
    update: {
      content: PRIVACY_POLICY_CONTENT,
      isActive: true,
    },
    create: {
      type: PolicyType.PRIVACY_POLICY,
      version: PRIVACY_POLICY_VERSION,
      content: PRIVACY_POLICY_CONTENT,
      isActive: true,
    },
  });
  console.log('✅ Privacy Policy seeded successfully.');
}
*/

async function main() {
  await seedCoreData();

  const seedFlag = process.argv
    .slice(2)
    .find((arg) => arg.startsWith('--seed='))
    ?.split('=')[1];

  if (seedFlag === 'tos') {
    await seedTermsOfService();
  } else if (seedFlag === 'privacy') {
    console.log('⚠️ Privacy Policy seeding is currently disabled.');
  } else {
    console.log(
      '🔄 No specific flag passed — Seeding Terms of Service by default (Privacy Policy disabled).',
    );
    await seedTermsOfService();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });