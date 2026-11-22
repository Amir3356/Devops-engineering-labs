/**
 * Event Stream API Layer
 */
export const getEventHistoryApi = async (limit = 30) => {
  return {
    success: true,
    data: {
      events: []
    }
  };
};
