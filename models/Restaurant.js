const mongoose = require('mongoose');
const slug = require('slug');

mongoose.Promise = global.Promise;

const restaurantSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        required: 'Please enter a restaurant name'
    },
    slug: String,
    description: {
        type: String,
        trim: true
    },
    tags: [String],
    createdAt: {
        type: Date,
        default: Date.now()
    },
    location: {
        type: {
            type: String,
            default: 'Point'
        },
        coordinates: [{
            type: Number,
            required: 'You must give a location'
        }],
        address: {
            type: String,
            required: 'We need an address!'
        }
    },
    photo: String,
    author: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: 'You must supply an author'
    }
}, {
    // add joined results to model for access. otherwise have to call explicitly
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// define index for lookup
restaurantSchema.index({
    name: 'text',
    description: 'text'
});

restaurantSchema.index({ location: '2dsphere' });

function autopopulate(next) {
    this.populate('reviews');
    return next();
};

restaurantSchema.pre('find', autopopulate);
restaurantSchema.pre('findOne', autopopulate);

// slugs autogenerated by mongodb for new places
restaurantSchema.pre('save', async function(next) {
    if(!this.isModified('name')) {
        return next();
    }
    this.slug = slug(this.name);

    // handle duplicated names being returned
    const slugRegExp = new RegExp(`^(${this.slug})((-[0-9]*)?)$`, 'i');
    const storesWithSlug = await this.constructor.find({ restaurant: slugRegExp });
    if(storesWithSlug.length) {
        this.slug = `${this.slug}-${storesWithSlug.length + 1}`
    }

    next();
});

// adding statics allows adding a method to the model
restaurantSchema.statics.getTagsList = function() {
    // mongodb pipeline operators
    return this.aggregate([
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } }},
        { $sort: { count: -1 }}
    ]);
};

restaurantSchema.statics.getTopList = function() {
    // lookup from = model being referenced, lowercased and pluralized
    return this.aggregate([
        { $lookup:
            { from: 'reviews', localField: '_id', foreignField: 'restaurant', as: 'reviews' }
        },
        // return only if 2+ reviews
        { $match: { 'reviews.1': { $exists: true }} },
        // if/when upgrade mongodb swap project for addField
        { $project: {
            averageRating: { $avg: '$reviews.rating' },
            photo: '$$ROOT.photo',
            name: '$$ROOT.name',
            review: '$$ROOT.reviews',
            slug: '$$ROOT.slug'
        }},
        { $sort: { averageRating: -1 } },
        { $limit: 8 }        
    ])
};

// kind-of join
restaurantSchema.virtual('reviews', {
    ref: 'Review', // model to link
    localField: '_id', // from restaurant 
    foreignField: 'restaurant' // from review model
});

module.exports = mongoose.model('Restaurant', restaurantSchema);