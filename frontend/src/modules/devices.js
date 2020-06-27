import { createAction, handleActions } from 'redux-actions';
import * as deviceProxies from 'proxies/device';

// Actions
const ACTION_ROOT = 'devices';

export const devicesRequested = createAction(`${ACTION_ROOT}/DEVICES_REQUESTED`);
export const devicesReceived = createAction(`${ACTION_ROOT}/DEVICES_RECEIVED`);
export const deviceUpdated = createAction(`${ACTION_ROOT}/DEVICE_UPDATED`);

// Reducer
const INITIAL_STATE = {
    isLoading: false,
    list: [],
    dictionary: {},
};

export default handleActions(
    {
        [devicesRequested]: state => ({
            ...state,
            isLoading: true,
        }),
        [devicesReceived]: (state, { payload }) => ({
            ...state,
            list: convertDevicesDictionaryToList(payload),
            dictionary: payload,
            isLoading: false,
            receivedAt: Date.now(),
        }),
        [deviceUpdated]: (state, { payload: { id, ...data } }) => {
            const updatedDevices = {
                ...state.dictionary,
                [id]: {
                    ...state.dictionary[id],
                    ...data,
                },
            };
            return {
                ...state,
                list: convertDevicesDictionaryToList(updatedDevices),
                dictionary: updatedDevices,
            };
        },
    },
    INITIAL_STATE
);

export function fetchDeviceList() {
    return async dispatch => {
        dispatch(devicesRequested());
        try {
            const response = await deviceProxies.getDevices();
            if (response.statusText === 'OK') {
                const { devices } = response.data;
                Object.keys(devices).forEach(key => {
                    const data = devices[key];
                    data.effect.active = !!data.effect.name;
                });

                dispatch(devicesReceived(devices));
            }
        } catch (error) {
            console.log('Error fetching devices', error.message);
        }
    };
}

export function addDevice(type, config) {
    return async dispatch => {
        const data = {
            type: type,
            config: config,
        };
        try {
            const response = await deviceProxies.createDevice(data);
            if (response.statusText === 'OK') {
                dispatch(fetchDeviceList());
            }
        } catch (error) {
            console.log('Error adding device', error.message);
        }
    };
}

export function updateDeviceConfig(type, config) {
    return async dispatch => {
        try {
            const response = await deviceProxies.updateDevice(config.name, { config: { ...config, type } });
            if (response.statusText === 'OK') {
                dispatch(fetchDeviceList());
            }
        } catch (error) {
            console.log('Error adding device', error.message);
        }
    };
}

export function setDeviceEffect(id, data) {
    return async (dispatch, getState) => {

        const device = getState().devices.dictionary[id];
        try {
            console.log(' wahat the devices here', device, data);

            dispatch(
                deviceUpdated({ id, ...device, effect: { ...device.effect, isProcessing: true } })
            );

            const response = await deviceProxies.setDeviceEffect(id, {
                type: data.type || 'wavelength(Reactive)',
                config: data,
            });

            dispatch(
                deviceUpdated({
                    id,
                    effect: { ...data, ...response.data.effect, isProcessing: false },
                })
            );
        } catch (error) {
            deviceUpdated({ id, ...device, effect: { ...device.effect, isProcessing: false } });
        }
    };
}

export function clearDeviceEffect(id) {
    return async (dispatch, getState) => {
        console.log('clear device', id);
        const device = getState().devices.dictionary[id];
        try {
            dispatch(
                deviceUpdated({ id, ...device, effect: { ...device.effect, isProcessing: true } })
            );

            const response = await deviceProxies.deleteDeviceEffect(id);
            dispatch(
                deviceUpdated({
                    id,
                    effect: { ...device.effect, active: false, isProcessing: false },
                })
            );
        } catch (error) {
            deviceUpdated({ id, ...device, effect: { ...device.effect, isProcessing: false } });
        }
    };
}

export function deleteDevice(id) {
    return async dispatch => {
        try {
            const response = await deviceProxies.deleteDevice(id);
            if (response.statusText === 'OK') {
                dispatch(fetchDeviceList());
            }
        } catch (error) {
            console.log('Error deleting device', error.message);
        }
    };
}

const convertDevicesDictionaryToList = (devices = {}) =>
    Object.keys(devices).map(key => {
        const currentDevice = devices[key];
        return {
            ...currentDevice,
            key,
            id: key,
            name: currentDevice.config.name,
        };
    });
