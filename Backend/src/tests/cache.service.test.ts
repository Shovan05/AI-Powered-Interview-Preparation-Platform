import {
  getCached,
  setCached,
  deleteCached,
} from "../services/cache.service";
import { getRedis } from "../config/redis";

jest.mock("../config/redis");

const mockedGetRedis = getRedis as jest.MockedFunction<typeof getRedis>;

interface FakeRedis {
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
}

const makeFakeRedis = (): FakeRedis => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
});

const useRedis = (fake: FakeRedis): void => {
  mockedGetRedis.mockReturnValue(
    fake as unknown as ReturnType<typeof getRedis>
  );
};

describe("cache.service", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // The service logs cache errors; keep the test output clean.
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getCached", () => {
    it("returns null when Redis is not configured", async () => {
      mockedGetRedis.mockReturnValue(null);

      expect(await getCached("key")).toBeNull();
    });

    it("returns the parsed value on a cache hit", async () => {
      const fake = makeFakeRedis();
      fake.get.mockResolvedValue(JSON.stringify({ score: 80 }));
      useRedis(fake);

      expect(await getCached("key")).toEqual({ score: 80 });
      expect(fake.get).toHaveBeenCalledWith("key");
    });

    it("returns null on a cache miss", async () => {
      const fake = makeFakeRedis();
      fake.get.mockResolvedValue(null);
      useRedis(fake);

      expect(await getCached("key")).toBeNull();
    });

    it("treats a Redis error as a miss instead of throwing", async () => {
      const fake = makeFakeRedis();
      fake.get.mockRejectedValue(new Error("connection lost"));
      useRedis(fake);

      expect(await getCached("key")).toBeNull();
    });
  });

  describe("setCached", () => {
    it("stores JSON with an expiry", async () => {
      const fake = makeFakeRedis();
      useRedis(fake);

      await setCached("key", { a: 1 }, 60);

      expect(fake.set).toHaveBeenCalledWith(
        "key",
        JSON.stringify({ a: 1 }),
        "EX",
        60
      );
    });

    it("does nothing when Redis is not configured", async () => {
      mockedGetRedis.mockReturnValue(null);

      await expect(setCached("key", { a: 1 }, 60)).resolves.toBeUndefined();
    });

    it("swallows Redis errors", async () => {
      const fake = makeFakeRedis();
      fake.set.mockRejectedValue(new Error("connection lost"));
      useRedis(fake);

      await expect(setCached("key", { a: 1 }, 60)).resolves.toBeUndefined();
    });
  });

  describe("deleteCached", () => {
    it("deletes the given keys", async () => {
      const fake = makeFakeRedis();
      useRedis(fake);

      await deleteCached("a", "b");

      expect(fake.del).toHaveBeenCalledWith("a", "b");
    });

    it("does not throw when Redis is missing or fails", async () => {
      mockedGetRedis.mockReturnValue(null);
      await expect(deleteCached("a")).resolves.toBeUndefined();

      const fake = makeFakeRedis();
      fake.del.mockRejectedValue(new Error("connection lost"));
      useRedis(fake);
      await expect(deleteCached("a")).resolves.toBeUndefined();
    });
  });
});