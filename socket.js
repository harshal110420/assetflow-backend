let io;

module.exports = {
  init: (httpServer) => {
    const { Server } = require("socket.io");
    io = new Server(httpServer, {
      cors: {
        origin: ["http://localhost:3000", process.env.FRONTEND_URL].filter(
          Boolean,
        ),
        credentials: true,
      },
    });

    io.on("connection", (socket) => {
      // Client join karega apne tenant room mein
      socket.on("join:tenant", (tenantId) => {
        socket.join(`tenant:${tenantId}`);
      });

      socket.on("disconnect", () => {});
    });

    return io;
  },

  getIO: () => {
    if (!io) throw new Error("Socket.io not initialized");
    return io;
  },

  // Helper — tenant ke sare connected users ko emit karo
  emitToTenant: (tenantId, event, data) => {
    if (!io) return;
    io.to(`tenant:${tenantId}`).emit(event, data);
  },
};
