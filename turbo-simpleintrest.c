#include<stdio.h>
#include<math.h>
#include<conio.h>

float main() {
    float principal, rate, time, simple_interest;

    // Input principal amount
    printf("Enter the principal amount: ");
    scanf("%f", &principal);

    // Input rate of interest
    printf("Enter the rate of interest (in percentage): ");
    scanf("%f", &rate);

    // Input time period in months
    printf("Enter the time period (in months): ");
    scanf("%f", &time);

    // Calculate simple interest
    simple_interest = (principal * rate * time) / 100;

    // Display the result
    printf("The Simple Interest is: %.2f\n", simple_interest);

    return 0;
}