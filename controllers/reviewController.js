const { collection, addDoc, doc, updateDoc, arrayUnion, getDocs, orderBy, limit, getDoc, query, arrayRemove, where } = require("firebase/firestore");
const { db } = require("../config/firebase");
const reviewCollection = collection(db, "reviews");

module.exports.addReview = async (req, res) => {
    try {
        const { userId, body, stars, course, instructor } = req.body;
        const keywords = [...course.toLowerCase().split(" "), ...instructor.toLowerCase().split(" ")]
        await addDoc(reviewCollection, {
            userId, 
            body, 
            stars, 
            course, 
            instructor,
            likes: [],
            shares: 0,
            createdAt: new Date,
            keywords,
        })
        res.status(200).json({ message: "Successfully added review" })
    } catch (error) {
        console.log(error);
        res.status(400).json({ error })
    }
}

module.exports.likeReview = async (req, res) => {
    try {
        const { userId, reviewId } = req.body;
        const reviewDoc = doc(reviewCollection, reviewId);
        await updateDoc(reviewDoc, {
            likes: arrayUnion(userId)
        })
        res.status(200).json({message: "Review liked successfully"})
    } catch (error) {
        console.log(error);
        res.status(400).json({ error })
    }
}

module.exports.getReviews = async (req, res) => {
    try {
        const reviewsQuery = query(reviewCollection, orderBy('createdAt', 'desc'), limit(30));
        const reviewsSnapshot = await getDocs(reviewsQuery);
        const reviews = await Promise.all(reviewsSnapshot.docs.map(async (Doc) => {
            const commentsCollection = collection(Doc.ref, 'comments');
            const commentsSnapshot = await getDocs(commentsCollection);
            const commentNum = commentsSnapshot.size;

            const userId = Doc.data().userId;
            const userDoc = doc(collection(db, "users"), userId);
            const userSnapshot = await getDoc(userDoc);
            const user = userSnapshot.data();
            return {
                id: Doc.id,
                userName: user.username,
                userProfilePic: user.profile_pic,
                commentNum,
                ...Doc.data()
            }
        }));
        res.status(200).json(reviews);
    } catch (error) {
        console.log(error);
        res.status(400).json({ error })
    }
}

module.exports.commentOnReview = async (req, res) => {
    try {
        const { userId, reviewId, body } = req.body;
        const reviewDoc = doc(reviewCollection, reviewId);
        const commentsCollection = collection(reviewDoc, 'comments');
        await addDoc(commentsCollection, {
            userId, 
            reviewId, 
            body,
            likes: [],
            createdAt: new Date,
        });
        res.status(200).json({ message: "Review commented successfully" });
    } catch (error) {
        console.log(error);
        res.status(400).json({ error })
    }
}

module.exports.getReviewComments = async (req, res) => {
    try {
        const { reviewId } = req.query;
        const reviewDoc = doc(reviewCollection, reviewId);
        const commentsCollection = collection(reviewDoc, 'comments');
        const commentRef = await getDocs(commentsCollection);
        const comments = await Promise.all(commentRef.docs.map(async (Doc) => {
            const userDoc = doc(collection(db, "users"), Doc.data().userId);
            const userSnapshot = await getDoc(userDoc);
            const user = userSnapshot.data();
            return {
                id: Doc.id,
                userName: user.username,
                userProfilePic: user.profile_pic,
                ...Doc.data()
            }
        }));
        res.status(200).json(comments);
    } catch (error) {
        console.log(error);
        res.status(400).json({ error })
    }
}

module.exports.likeReviewComment = async (req, res) => {
    try {
        const { reviewId, userId, commentId } = req.body;
        const reviewDoc = doc(reviewCollection, reviewId);
        const commentsCollection = collection(reviewDoc, 'comments');
        const commentDoc = doc(commentsCollection, commentId);

        const commentSnapshot = await getDoc(commentDoc);
        const commentData = commentSnapshot.data();

        if (commentData.likes.includes(userId)) {
            await updateDoc(commentDoc, {
                likes: arrayRemove(userId)
            });
            res.status(200).json({ message: "Like removed successfully" });
        } else {
            await updateDoc(commentDoc, {
                likes: arrayUnion(userId)
            });
            res.status(200).json({ message: "Comment liked successfully" });
        }
    } catch (error) {
        console.log(error);
        res.status(400).json({ error })
    }
}

module.exports.searchReviews = async (req, res) => {
    try {
        const { query: searchWords } = req.query;
        const queryWords = searchWords.toLowerCase().split(' ');
        const result = [];
        const set = new Set();
        for (const q of queryWords) {
            const data = await getDocs(query(reviewCollection, where('keywords', 'array-contains', q)));
            const items = data.docs.map((i) => {
                if (!set.has(i.id)) {
                    return {
                        id: i.id,
                        ...i.data()
                    }
                }
            })
            result.push(...items);
        }
        res.status(200).json(result || []);
    } catch (error) {
        console.log(error);
        res.status(400).json({ error })
    }
}

module.exports.addFeedback = async (req, res) => {
    try {
        const { stars, feedback, userId } = req.body;
        const feedbackCollection = collection(db, "feedbacks");
        await addDoc(feedbackCollection, {
            stars,
            feedback,
            userId,
            createdAt: new Date
        });

        res.status(200).json({ message: "Feedback added successfully" });
    } catch (error) {
        console.log(error);
        res.status(400).json({ error })
    }
}