-- Una reserva puede tener varios servicios, que se hacen seguidos.
-- El orden importa: primero se crea la tabla, después se copian los servicios
-- de las reservas existentes y recién al final se elimina Booking.serviceId.

-- CreateTable
CREATE TABLE "BookingItem" (
    "bookingId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "BookingItem_pkey" PRIMARY KEY ("bookingId","position")
);

-- CreateIndex
CREATE INDEX "BookingItem_serviceId_idx" ON "BookingItem"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingItem_bookingId_serviceId_key" ON "BookingItem"("bookingId", "serviceId");

-- AddForeignKey
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cada reserva existente pasa a tener su único servicio en la posición 0
INSERT INTO "BookingItem" ("bookingId", "serviceId", "position")
SELECT "id", "serviceId", 0 FROM "Booking";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_serviceId_fkey";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "serviceId";
