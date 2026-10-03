#include<stdio.h>
#include<math.h>
#include<conio.h>
int main()
{
    int side, area;
    printf("Enter the side of the square: ");
    scanf("%d", &side);
    
    area = side * side;
    
    printf("The area of the square is: %d", area);
    getch();
    return 0;
}