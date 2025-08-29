const mongoose = require('mongoose');

const giveawaySchema = new mongoose.Schema({
    messageId: {
        type: String,
        required: true,
        unique: true
    },
    channelId: {
        type: String,
        required: true
    },
    guildId: {
        type: String,
        required: true
    },
    prize: {
        type: String,
        required: true
    },
    winnerCount: {
        type: Number,
        required: true,
        default: 1
    },
    endTime: {
        type: Date,
        required: true
    },
    hostedBy: {
        type: String,
        required: true
    },
    hasEnded: {
        type: Boolean,
        default: false
    },
    winners: {
        type: [String],
        default: []
    },
    participants: {
        type: [String],
        default: []
    },
    paused: {
        type: Boolean,
        default: false
    },
    luckyRoleIds: {
        type: [String],
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Giveaway', giveawaySchema);
