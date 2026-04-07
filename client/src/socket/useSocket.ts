import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

export function useSocket(socket: Socket, autoConnect: boolean = true) {
  const socketRef = useRef(socket);

  useEffect(() => {
    if (autoConnect && !socketRef.current.connected) {
      socketRef.current.connect();
    }

    return () => {
      if (socketRef.current.connected) {
        socketRef.current.disconnect();
      }
    };
  }, [autoConnect]);

  return socketRef.current;
}
