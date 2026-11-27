import { Injectable } from '@nestjs/common';
import { checkoutCurrency } from '../checkout/currency.js';
import type { DashboardPeriod, ShopDashboard } from '../generated/graphql/types.js';
import { Prisma } from '../generated/prisma/client.js';
import { requireScope, type RequestContext } from '../scope.js';
import { DashboardRepository } from './dashboard.repository.js';

// Stored totals can have 30 whole digits, and the sum must retain cents.
const Revenue = Prisma.Decimal.clone({ precision: 40 });
const timeZone = 'Europe/Sofia';
const shopDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const shopOffset = new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'longOffset' });
const days: Record<DashboardPeriod, number> = { DAYS_7: 7, DAYS_14: 14, DAYS_30: 30 };

function shopMidnight(date: string): Date {
  const utcMidnight = new Date(`${date}T00:00:00Z`);
  // Sofia uses the same offset at local and UTC midnight, including on transition dates.
  const offset = shopOffset.formatToParts(utcMidnight).find(({ type }) => type === 'timeZoneName');
  return new Date(`${date}T00:00:00${offset?.value.slice(3) || 'Z'}`);
}

@Injectable()
export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}

  async read(context: RequestContext, period: DashboardPeriod): Promise<ShopDashboard> {
    const scope = await requireScope(context, false);
    const asOf = new Date();
    const endDate = shopDate.format(asOf);
    // Do calendar arithmetic on date labels, independent of 23- and 25-hour days.
    const date = new Date(`${endDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - days[period] + 1);
    const startDate = date.toISOString().slice(0, 10);
    const daily = new Map<string, { orderCount: number; completedRevenue: Prisma.Decimal }>();
    for (let index = 0; index < days[period]; index++) {
      daily.set(date.toISOString().slice(0, 10), {
        orderCount: 0,
        completedRevenue: new Revenue(0),
      });
      date.setUTCDate(date.getUTCDate() + 1);
    }

    const { orders, newCustomerCount, outOfStockVariantCount, recentOrders } =
      await this.repository.read(scope, shopMidnight(startDate), asOf);
    let completedRevenue = new Revenue(0);
    for (const order of orders) {
      const bucket = daily.get(shopDate.format(order.placedAt));
      if (!bucket) {
        continue;
      }
      bucket.orderCount++;
      if (order.status !== 'COMPLETED' || order.currency !== checkoutCurrency) {
        continue;
      }
      bucket.completedRevenue = bucket.completedRevenue.plus(order.total);
      completedRevenue = completedRevenue.plus(order.total);
    }
    return {
      period,
      startDate,
      endDate,
      asOf: asOf.toISOString(),
      timeZone,
      currency: checkoutCurrency,
      orderCount: orders.length,
      completedRevenue: completedRevenue.toFixed(2),
      newCustomerCount,
      outOfStockVariantCount,
      daily: Array.from(daily, ([date, bucket]) => ({
        date,
        orderCount: bucket.orderCount,
        completedRevenue: bucket.completedRevenue.toFixed(2),
      })),
      recentOrders: recentOrders.map(({ id, orderNumber, placedAt, status, currency, total }) => ({
        id,
        number: orderNumber,
        placedAt: placedAt.toISOString(),
        status,
        currency,
        total: total.toFixed(2),
      })),
    };
  }
}
