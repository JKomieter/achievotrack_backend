const { collection, addDoc, getDocs, doc, getDoc, query, where } = require("firebase/firestore");
const { db } = require("../config/firebase");
require('dotenv').config();
const { Expo } = require('expo-server-sdk');

let expo = new Expo({
    accessToken: process.env.EXPO_ACCESS_TOKEN,
    useFcmV1: false
});

module.exports.addItem = async (req, res) => {
    try {
        const { title, description, images, sellerName, sellerEmail, sellerPhone, category, sellerId, price } = req.body;
        const itemsCollection = collection(db, 'market');
        const keywords = title.toLowerCase().split(' ');
        await addDoc(itemsCollection, {
            title,
            description,
            images,
            sellerName,
            sellerEmail,
            sellerPhone,
            category: category.toLowerCase(),
            sellerId,
            price,
            keywords
        })

        res.status(200).json({ message: "Item added successfully" })
    } catch (error) {
        console.log(error);
        res.status(400).json({ error: "Something went wrong" })
    }
}


module.exports.getItems = async (req, res) => {
    try {
        // userId will be used for more personalized feed
        const marketCollection = collection(db, 'market');
        const data = await getDocs(marketCollection);
        const items = data.docs.map((i) => {
            return {
                id: i.id,
                ...i.data()
            }
        })
        res.status(200).json(items || [])
    } catch (error) {
        console.log(error);
        res.status(400).json({ error: "Something went wrong" })
    }
}

module.exports.addItemToWishlist = async (req, res) => {
    try {
        const { itemId, userId } = req.body;
        const usersCollection = collection(db, 'users');
        const userDoc = doc(usersCollection, userId);
        const wishlistCollection = collection(userDoc, 'wishlist');
        const marketCollection = collection(db, 'market');
        const itemDoc = doc(marketCollection, itemId);
        const item = await getDoc(itemDoc);
        await addDoc(wishlistCollection, {
            id: item.id,
            ...item.data(),
        })
        res.status(200).json({ message: "Item added to wishlist successfully" })
    } catch (error) {
        console.log(error);
        res.status(400).json({ error: "Something went wrong" })
    }
}

module.exports.getWishlist = async (req, res) => {
    try {
        const { userId } = req.query;
        const usersCollection = collection(db, 'users');
        const userDoc = doc(usersCollection, userId);
        const wishlistCollection = collection(userDoc, 'wishlist');
        const data = await getDocs(wishlistCollection);
        const wishlist = [];
        for (const d of data.docs) {
            wishlist.push({ id: d.id, ...d.data() })
        }
        res.status(200).json(wishlist)
    } catch (error) {
        console.log(error);
        res.status(400).json({ error: "Something went wrong" })
    }
}

module.exports.searchItem = async (req, res) => {
    try {
        const { searchQuery } = req.query;
        const queryWords = searchQuery.toLowerCase().split(' ');
        const marketCollection = collection(db, 'market');
        const result = []
        const set = new Set();
        for (const q of queryWords) {
            const data = await getDocs(query(marketCollection, where('keywords', 'array-contains', q)));
            const items = data.docs.map((i) => {
                if (!set.has(i.id)) {
                    return {
                        id: i.id,
                        ...i.data()
                    }
                }
                set.add(i.id);
            })
            result.push(...items);
        }

        res.status(200).json(result || [])
    } catch (error) {
        console.log(error);
        res.status(400).json({ error: "Something went wrong" })
    }
}

module.exports.getRelatedItems = async (req, res) => {
    try {
        const { category, keywords, id } = req.body;
        console.log(category, keywords, id)
        const marketCollection = collection(db, 'market');
        const result = [];
        const set = new Set();
        for (const q of keywords) {
            const searchByKeywords = query(marketCollection, where('keywords', 'array-contains', q.toLowerCase()));
            const searchByCategory = query(marketCollection, where('category', '==', category.toLowerCase()));

            const [keywordsSnapshot, categorySnapshot] = await Promise.all([
                getDocs(searchByKeywords),
                getDocs(searchByCategory),
            ]);

            const keywordsResults = keywordsSnapshot.docs.map((i) => {
                if (!set.has(i.id) && i.id !== id) {
                    set.add(i.id);
                    return {
                        id: i.id,
                        ...i.data()
                    }
                }
            }).filter(Boolean);

            const categoryResults = categorySnapshot.docs.map((i) => {
                if (!set.has(i.id) && i.id !== id) {
                    set.add(i.id);
                    return {
                        id: i.id,
                        ...i.data()
                    }
                }
            }).filter(Boolean);

            result.push(...keywordsResults, ...categoryResults);
        }
        console.log(result)
        res.status(200).json(result || [])
    } catch (error) {
        console.log(error);
        res.status(400).json({ error: "Something went wrong" })
    }
}

async function sendNotificationToSeller(sellerPushToken, wisher) {
    // send notification to seller
    const message = {
        to: sellerPushToken,
        sound: 'default',
        title: 'Interest in your item',
        body: `${wisher.wisherName}(${wisher.wisherEmail}) is interested in your item ${wisher.itemName}`,
    };
    const result = await expo.sendPushNotificationsAsync([message]);
    console.log('Push notification result:', result);
}

module.exports.showInterest = async (req, res) => {
    try {
        const { userId, itemId } = req.body;
        const marketCollection = collection(db, 'market');
        const itemDoc = doc(marketCollection, itemId);
        const item = await getDoc(itemDoc);

        const usersCollection = collection(db, 'users');
        const wishersDoc = doc(usersCollection, userId);
        const wisherData = await getDoc(wishersDoc);
        const wisher = {
            id: wisherData.id,
            wisherName: wisherData.data().name,
            wisherEmail: wisherData.data().email,
            itemName: item.title
        }

        const granterDoc = doc(usersCollection, item.sellerId);
        const granterData = await getDoc(granterDoc);
        const granter = granterData.data();
        // send notification to seller
        await sendNotificationToSeller(granter.pushToken.data, wisher);

        res.status(200).json({ message: "Interest shown successfully" })
    } catch (error) {
        console.log(error);
        res.status(400).json({ error: "Something went wrong" })
    }
}