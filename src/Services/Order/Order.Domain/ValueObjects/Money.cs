namespace Order.Domain.ValueObjects;

public sealed record Money(decimal Amount)
{
    public static Money Zero => new(0);

    public static Money operator +(Money left, Money right) => new(left.Amount + right.Amount);
    public static Money operator *(Money money, int quantity) => new(money.Amount * quantity);
}
