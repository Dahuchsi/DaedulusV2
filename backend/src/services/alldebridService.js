const axios = require('axios');
const { ALLDEBRID_API_KEY, ALLDEBRID_API_URL } = require('../config/constants');

class AllDebridService {
    constructor() {
        this.apiKey = ALLDEBRID_API_KEY;
        this.baseURL = ALLDEBRID_API_URL;
    }

    async addMagnet(magnetLink) {
        try {
            const params = new URLSearchParams();
            params.append('agent', 'Daedulus');
            params.append('apikey', this.apiKey);
            params.append('magnets[]', magnetLink);

            const response = await axios.post(`${this.baseURL}/magnet/upload`, params);
            return response.data;
        } catch (error) {
            if (error.response) {
                console.error('AllDebrid API Error Data:', JSON.stringify(error.response.data, null, 2));
                console.error('AllDebrid API Error Status:', error.response.status);
            } else {
                console.error('AllDebrid API Error:', error.message);
            }
            return {
                status: 'error',
                error: {
                    message: error.response?.data?.error?.message || 'Unknown AllDebrid error.'
                }
            };
        }
    }

    async getMagnetStatus(magnetId) {
        try {
            const response = await axios.get(`${this.baseURL}/magnet/status`, {
                params: { agent: 'Daedulus', apikey: this.apiKey, id: magnetId }
            });
            return response.data;
        } catch (error) {
            console.error('AllDebrid API Error during getMagnetStatus:', error.response ? error.response.data : error.message);
            return { status: 'error', error: { message: 'Failed to get magnet status.' } };
        }
    }

    async unlockLink(link) {
        try {
            const params = new URLSearchParams();
            params.append('agent', 'Daedulus');
            params.append('apikey', this.apiKey);
            params.append('link', link);

            const response = await axios.post(`${this.baseURL}/link/unlock`, params);
            return response.data;
        } catch (error) {
            console.error('AllDebrid API Error during unlockLink:', error.response ? error.response.data : error.message);
            return { status: 'error', error: { message: 'Failed to unlock link.' } };
        }
    }
}

module.exports = new AllDebridService();
