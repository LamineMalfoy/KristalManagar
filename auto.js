const axios = require('axios');
const logger = require('./logger.js');

 
const accessToken = 'vk1.a.aD-MCJnLcFLG_dvvfGNP6gvUCx58QsDbnbp5gdM_qgIfHuS75K0_LCnaezBb2h5yR9BlRbokfn1lz7h6ALMQoro4aZmwjCaW6VUH9GoIc5d6J1eCIrvOWyxPV9W_buEqv2ga7GwJPLKMLc1846NtileN7k4iowMGkQo23_bzeGJax6d5Bg103bPXxoRK-gsIWzH8d81m-kG89Jyo-nj9yw';

 
const requestUrl = `https://api.vk.com/method/friends.getRequests?fields=first_name,last_name&access_token=${accessToken}&v=5.131`;

 
async function vkApiRequest(url) {
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        logger.error('Error making API request:', error);
        return null;
    }
}

 
async function acceptFriendRequest(userId, accessToken) {
    const acceptUrl = `https://api.vk.com/method/friends.add?user_id=${userId}&access_token=${accessToken}&v=5.131`;
    const response = await vkApiRequest(acceptUrl);
    if (response && response.response === 1) {
        logger.log(`Accepted friend request from user ID: ${userId}`);
    } else {
        logger.log(`Failed to accept friend request from user ID: ${userId}`);
    }
}

 
async function main() {
    const response = await vkApiRequest(requestUrl);

    if (response && response.response && Array.isArray(response.response.items)) {
        for (const user of response.response.items) {
            await acceptFriendRequest(user.id, accessToken);
        }
    } else {
        logger.log("No friend requests to process.");
    }
}

 
setInterval(main, 30000);

 
main();
