#include<stdio.h>
#include<conio.h>
int main()
{
    int base, height, area;
    printf("Enter the base of the triangle: ");
    scanf("%d", &base);
    printf("Enter the height of the triangle: ");
    scanf("%d", &height);
    
    area = 0.5 * base * height;
    
    printf("The area of the triangle is: %d", area);
    getch();
    return 0;
}