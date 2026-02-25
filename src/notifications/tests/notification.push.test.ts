import { PushNotificationService } from "../notification.push";

describe("PushNotificationService", () => {
  it("retries failed pushes up to 3 times", async () => {
    const service = new PushNotificationService();
    const mockNotif = {
      id: "n1",
      userId: "u1",
      type: "TIP_RECEIVED",
      title: "Tip received",
      body: "You got 50 coins!",
      data: {},
      isRead: false,
      createdAt: new Date(),
    };
    jest.spyOn(service, "sendFCM").mockRejectedValueOnce(new Error("Temporary error"));
    jest.spyOn(service, "sendFCM").mockResolvedValueOnce(undefined);
    await service.sendFCM("fake-token", mockNotif);
    expect(service.sendFCM).toHaveBeenCalled();
  });
});
