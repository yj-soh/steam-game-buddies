'use strict'

const similarity = require('compute-cosine-similarity');

var Recommender = function () {};

// vectors should be normalized
// returns array of (index, similarity) pairs
Recommender.recommend = function (userVector, allUsersVectors, numRecommendations) {
    var similarities = [];
    for (var i = 0; i < allUsersVectors.length; i++) {
        similarities.push({
            'index': i,
            'similarity': similarity(userVector, allUsersVectors[i])
        });
    }
    similarities.sort(function (a, b) {
        return b.similarity - a.similarity;
    });

    if (isNaN(numRecommendations) || numRecommendations < 0) {
        return similarities;
    }
    return similarities.slice(0, numRecommendations)
};

Recommender.normalizeVector = function (vector) {
    // compute magnitude of vector
    var magnitude = 0;
    for (var i = 0; i < vector.length; i++) {
        magnitude += vector[i] * vector[i];
    }
    magnitude = Math.sqrt(magnitude);

    for (var i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
    }
};

// var vector1 = [1, 0, 9, 4.5];
// var vector2 = [1, 0, 5, 1];
// var vector3 = [0, 0, 1, 0];
// var vector4 = [0, 100, 0, 0];
// Recommender.normalizeVector(vector1);
// Recommender.normalizeVector(vector2);
// Recommender.normalizeVector(vector3);
// Recommender.normalizeVector(vector4);
// console.log(Recommender.recommend(vector1, [vector2, vector3, vector4], 2));