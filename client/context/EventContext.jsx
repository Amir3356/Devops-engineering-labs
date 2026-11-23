import { createContext, useContext, useState, useEffect } from 'react';
import eventService from '../services/event.service';

const EventContext = createContext(null);

export const EventProvider = ({ children }) => {
  const [events, setEvents] = useState([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll event history from API Gateway via eventService
  useEffect(() => {
    let isMounted = true;

    const poll = async () => {
      const incoming = await eventService.fetchHistory(30);
      if (incoming && isMounted) {
        setEvents(prev => {
          if (incoming.length > prev.length) {
            setUnreadCount(c => c + (incoming.length - prev.length));
          }
          return incoming;
        });
      }
    };

    poll();
    const interval = setInterval(poll, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const addLocalEvent = (eventName, source, data) => {
    const newEvent = eventService.createLocalEvent(eventName, source, data);
    setEvents(prev => [newEvent, ...prev]);
    setUnreadCount(c => c + 1);
  };

  const openDrawer = () => {
    setIsDrawerOpen(true);
    setUnreadCount(0);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
  };

  const clearEvents = () => {
    setEvents([]);
    setUnreadCount(0);
  };

  return (
    <EventContext.Provider value={{
      events,
      isDrawerOpen,
      unreadCount,
      openDrawer,
      closeDrawer,
      addLocalEvent,
      clearEvents,
      getBadgeColor: eventService.getBadgeColor
    }}>
      {children}
    </EventContext.Provider>
  );
};

export const useEvents = () => useContext(EventContext);
